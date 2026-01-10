package com.prepaidly.service;

import com.prepaidly.model.XeroConnection;
import com.prepaidly.repository.XeroConnectionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * Token Refresh Scheduler
 * 
 * Automatically refreshes Xero OAuth tokens to prevent expiration.
 * 
 * Xero token lifecycle:
 * - Access Token: expires after 30 minutes
 * - Refresh Token: expires after 60 days of inactivity
 * 
 * This scheduler runs periodically to:
 * 1. Refresh access tokens that are about to expire
 * 2. Keep refresh tokens active by using them regularly
 * 3. Update tenant names if missing
 * 
 * By running every 12 hours, we ensure:
 * - Refresh tokens never expire (used well before 60-day limit)
 * - Access tokens are always fresh when needed
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TokenRefreshScheduler {

    private final XeroConnectionRepository xeroConnectionRepository;
    private final XeroOAuthService xeroOAuthService;

    /**
     * Refresh all Xero tokens every 6 hours
     * 
     * Cron expression: 0 0 0/6 * * * (every 6 hours at minute 0)
     * This ensures refresh tokens are used regularly and never expire.
     * 
     * Xero refresh tokens expire after 60 days of inactivity.
     * By refreshing every 6 hours, we ensure tokens are used at least 240 times
     * before the 60-day period, keeping them well within the active window.
     */
    @Scheduled(cron = "0 0 0/6 * * *")
    public void refreshAllTokens() {
        log.info("=== Starting scheduled token refresh ===");
        
        List<XeroConnection> connections = xeroConnectionRepository.findAll();
        log.info("Found {} Xero connections to refresh", connections.size());
        
        int successCount = 0;
        int failureCount = 0;
        
        for (XeroConnection connection : connections) {
            try {
                refreshConnection(connection);
                successCount++;
            } catch (Exception e) {
                failureCount++;
                log.error("Failed to refresh connection for tenant {}: {}", 
                    connection.getTenantId(), e.getMessage());
            }
        }
        
        log.info("=== Token refresh completed: {} success, {} failed ===", successCount, failureCount);
    }

    /**
     * Refresh a single connection's tokens
     * 
     * This method handles token refresh with proper error handling.
     * If refresh fails, it logs the error but doesn't throw, allowing
     * other connections to be refreshed.
     */
    private void refreshConnection(XeroConnection connection) {
        String tenantId = connection.getTenantId();
        String tenantName = connection.getTenantName() != null ? connection.getTenantName() : "Unknown";
        log.info("Refreshing tokens for tenant: {} ({})", tenantName, tenantId);
        
        try {
            // Refresh the tokens - this uses REQUIRES_NEW transaction, so failures won't affect other connections
            XeroConnection refreshedConnection = xeroOAuthService.refreshTokens(connection);
            log.info("✓ Successfully refreshed tokens for tenant {} ({}). New expiry: {}", 
                tenantName, tenantId, refreshedConnection.getExpiresAt());
            
            // Always try to update tenant name during refresh to keep it current
            // This ensures tenant names are populated even if they were lost due to transaction errors
            try {
                updateTenantName(refreshedConnection);
            } catch (Exception e) {
                // Don't fail the refresh if tenant name update fails
                log.warn("Could not update tenant name for {}: {}", tenantId, e.getMessage());
            }
        } catch (org.springframework.web.client.HttpClientErrorException e) {
            // Handle HTTP errors (401, 403, etc.) - these indicate token is invalid/expired
            if (e.getStatusCode().value() == 401 || e.getStatusCode().value() == 403) {
                log.error("✗ Token refresh failed for tenant {} ({}): Refresh token expired or invalid. User needs to reconnect. Error: {}", 
                    tenantName, tenantId, e.getResponseBodyAsString());
            } else {
                log.error("✗ Token refresh failed for tenant {} ({}): HTTP error {}. Error: {}", 
                    tenantName, tenantId, e.getStatusCode(), e.getResponseBodyAsString());
            }
            // Don't throw - allow other connections to be refreshed
        } catch (Exception e) {
            log.error("✗ Error refreshing tokens for tenant {} ({}): {}", tenantName, tenantId, e.getMessage(), e);
            // Don't throw - allow other connections to be refreshed
        }
    }
    
    /**
     * Public method to refresh a specific connection (can be called after reconnection)
     */
    public void refreshConnectionById(String tenantId) {
        xeroConnectionRepository.findByTenantId(tenantId).ifPresentOrElse(
            connection -> {
                log.info("Manually refreshing connection for tenant: {}", tenantId);
                refreshConnection(connection);
            },
            () -> log.warn("Connection not found for tenant: {}", tenantId)
        );
    }

    /**
     * Fetch and update tenant name from Xero API
     */
    private void updateTenantName(XeroConnection connection) {
        try {
            String accessToken = xeroOAuthService.getValidAccessToken(connection);
            Map<String, Object> tenantInfo = xeroOAuthService.getTenantInfo(accessToken, connection.getTenantId());
            
            if (tenantInfo != null) {
                String tenantName = (String) tenantInfo.get("Name");
                if (tenantName != null && !tenantName.trim().isEmpty()) {
                    // Only update if different to avoid unnecessary database writes
                    if (!tenantName.equals(connection.getTenantName())) {
                        connection.setTenantName(tenantName);
                        xeroConnectionRepository.save(connection);
                        log.info("Updated tenant name to '{}' for tenant {}", tenantName, connection.getTenantId());
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Could not update tenant name for {}: {}", connection.getTenantId(), e.getMessage());
        }
    }

    /**
     * Manual trigger for token refresh (can be called via API)
     */
    public void refreshTokensNow() {
        log.info("Manual token refresh triggered");
        refreshAllTokens();
    }
}

