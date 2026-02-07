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
 * - Refresh token rotation: each refresh returns a NEW refresh token
 * 
 * This scheduler runs every 6 hours to:
 * 1. Refresh access tokens that are about to expire
 * 2. Keep refresh tokens active (prevents 60-day inactivity expiration)
 * 3. Detect and mark DISCONNECTED connections (invalid_grant)
 * 4. Update tenant names if missing
 * 
 * Only CONNECTED connections are refreshed. DISCONNECTED connections
 * require user re-authorization.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TokenRefreshScheduler {

    private final XeroConnectionRepository xeroConnectionRepository;
    private final XeroOAuthService xeroOAuthService;

    /**
     * Refresh all CONNECTED Xero tokens every 6 hours.
     * 
     * Skips DISCONNECTED connections (they need user re-authorization).
     * On invalid_grant, marks the connection as DISCONNECTED.
     */
    @Scheduled(cron = "0 0 0/6 * * *")
    public void refreshAllTokens() {
        log.info("=== Starting scheduled token refresh ===");
        
        // Only refresh CONNECTED connections
        List<XeroConnection> connections = xeroConnectionRepository
            .findByConnectionStatus(XeroConnection.STATUS_CONNECTED);
        
        int totalCount = (int) xeroConnectionRepository.count();
        int disconnectedCount = totalCount - connections.size();
        
        log.info("Found {} CONNECTED connections to refresh ({} DISCONNECTED, {} total)", 
            connections.size(), disconnectedCount, totalCount);
        
        int successCount = 0;
        int failureCount = 0;
        int disconnectedByRefresh = 0;
        
        for (XeroConnection connection : connections) {
            try {
                refreshConnection(connection);
                successCount++;
            } catch (XeroOAuthService.InvalidGrantException e) {
                disconnectedByRefresh++;
                log.warn("Connection for tenant {} marked DISCONNECTED during scheduled refresh: {}", 
                    connection.getTenantId(), e.getErrorDescription());
            } catch (Exception e) {
                failureCount++;
                log.error("Failed to refresh tenant {}: {}", connection.getTenantId(), e.getMessage());
            }
        }
        
        log.info("=== Token refresh completed: {} success, {} failed, {} newly disconnected ===", 
            successCount, failureCount, disconnectedByRefresh);
    }

    /**
     * Refresh a single connection's tokens.
     * 
     * On success: updates tokens, marks CONNECTED, updates tenant name.
     * On invalid_grant: marks DISCONNECTED (handled by XeroOAuthService.refreshTokens).
     * On other errors: logs but does NOT disconnect (may be transient).
     */
    private void refreshConnection(XeroConnection connection) {
        String tenantId = connection.getTenantId();
        String tenantName = connection.getTenantName() != null ? connection.getTenantName() : "Unknown";
        
        // Skip if already disconnected
        if (!connection.isConnected()) {
            log.debug("Skipping DISCONNECTED tenant: {} ({}). Reason: {}", 
                tenantName, tenantId, connection.getDisconnectReason());
            return;
        }
        
        log.info("Refreshing tokens for tenant: {} ({})", tenantName, tenantId);
        
        try {
            // refreshTokens uses REQUIRES_NEW transaction
            // On invalid_grant, it marks the connection DISCONNECTED and throws InvalidGrantException
            XeroConnection refreshedConnection = xeroOAuthService.refreshTokens(connection);
            log.info("Successfully refreshed tokens for tenant {} ({}). New expiry: {}", 
                tenantName, tenantId, refreshedConnection.getExpiresAt());
            
            // Update tenant name during refresh
            try {
                updateTenantName(refreshedConnection);
            } catch (Exception e) {
                log.debug("Could not update tenant name for {}: {}", tenantId, e.getMessage());
            }
        } catch (XeroOAuthService.InvalidGrantException e) {
            // Connection already marked DISCONNECTED by refreshTokens
            log.error("Token refresh failed for tenant {} ({}): {}. Connection marked DISCONNECTED. User must re-authorize.", 
                tenantName, tenantId, e.getErrorDescription());
            throw e; // Re-throw so caller can count disconnections
        } catch (Exception e) {
            // Transient errors (network issues, rate limits, etc.) - don't disconnect
            log.error("Token refresh error for tenant {} ({}): {} (not marking as disconnected - may be transient)", 
                tenantName, tenantId, e.getMessage());
            // Don't throw - allow other connections to be refreshed
        }
    }
    
    /**
     * Public method to refresh a specific connection by tenant ID.
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
     * Fetch and update tenant name from Xero API.
     */
    private void updateTenantName(XeroConnection connection) {
        try {
            String accessToken = xeroOAuthService.getValidAccessToken(connection);
            Map<String, Object> tenantInfo = xeroOAuthService.getTenantInfo(accessToken, connection.getTenantId());
            
            if (tenantInfo != null) {
                String tenantName = (String) tenantInfo.get("Name");
                if (tenantName != null && !tenantName.trim().isEmpty()) {
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
     * Manual trigger for token refresh (can be called via API).
     */
    public void refreshTokensNow() {
        log.info("Manual token refresh triggered");
        refreshAllTokens();
    }
}

