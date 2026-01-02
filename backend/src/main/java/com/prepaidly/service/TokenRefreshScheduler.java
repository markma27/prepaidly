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
     * Refresh all Xero tokens every 12 hours
     * 
     * Cron expression: 0 0 0/12 * * * (every 12 hours at minute 0)
     * This ensures refresh tokens are used regularly and never expire.
     */
    @Scheduled(cron = "0 0 0/12 * * *")
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
     */
    private void refreshConnection(XeroConnection connection) {
        String tenantId = connection.getTenantId();
        log.info("Refreshing tokens for tenant: {} ({})", 
            connection.getTenantName() != null ? connection.getTenantName() : "Unknown", 
            tenantId);
        
        try {
            // Refresh the tokens
            XeroConnection refreshedConnection = xeroOAuthService.refreshTokens(connection);
            log.info("Successfully refreshed tokens for tenant {}. New expiry: {}", 
                tenantId, refreshedConnection.getExpiresAt());
            
            // If tenant name is missing, try to fetch and store it
            if (refreshedConnection.getTenantName() == null || refreshedConnection.getTenantName().trim().isEmpty()) {
                updateTenantName(refreshedConnection);
            }
        } catch (Exception e) {
            log.error("Error refreshing tokens for tenant {}: {}", tenantId, e.getMessage(), e);
            throw e;
        }
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
                    connection.setTenantName(tenantName);
                    xeroConnectionRepository.save(connection);
                    log.info("Updated tenant name to '{}' for tenant {}", tenantName, connection.getTenantId());
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

