package com.prepaidly.controller;

import com.prepaidly.model.XeroConnection;
import com.prepaidly.repository.XeroConnectionRepository;
import com.prepaidly.service.XeroOAuthService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Sync Controller
 * 
 * REST controller for synchronizing and refreshing Xero OAuth connections. This controller
 * handles the maintenance of Xero API connections by refreshing expired access tokens and
 * verifying that the connection to Xero is still valid.
 * 
 * Xero OAuth tokens have a limited lifespan:
 * - Access tokens expire after 30 minutes
 * - Refresh tokens can be used to obtain new access tokens
 * - Refresh tokens may expire if not used for extended periods
 * 
 * The sync operation performs the following steps:
 * 1. Retrieves the stored Xero connection for the tenant
 * 2. Refreshes OAuth tokens if they are expired or about to expire
 * 3. Verifies the connection is still valid by fetching tenant information from Xero
 * 4. Returns connection status and tenant details
 * 
 * This endpoint is useful for:
 * - Periodic connection health checks
 * - Refreshing tokens before they expire
 * - Verifying Xero connection status
 * - Troubleshooting connection issues
 * 
 * Note: This endpoint does not sync data (accounts, invoices, etc.) - it only refreshes
 * and verifies the OAuth connection. Use XeroController endpoints to fetch actual data.
 */
@Slf4j
@RestController
@RequestMapping("/api/sync")
@RequiredArgsConstructor
public class SyncController {

    private final XeroOAuthService xeroOAuthService;
    private final XeroConnectionRepository xeroConnectionRepository;

    /**
     * Sync Xero Connection
     * 
     * Refreshes OAuth tokens and verifies the Xero connection for a tenant. This endpoint
     * ensures that the stored OAuth tokens are valid and can be used to make API calls to Xero.
     * 
     * The sync process:
     * 1. Looks up the Xero connection record for the tenant
     * 2. Refreshes access/refresh tokens if they are expired or close to expiration
     * 3. Obtains a valid access token (either existing or newly refreshed)
     * 4. Verifies the connection by calling Xero API to get tenant information
     * 5. Returns success with tenant details or an error if verification fails
     * 
     * If tokens are successfully refreshed, they are automatically saved to the database
     * for future use. If the connection cannot be verified, it may indicate that:
     * - The refresh token has expired (user needs to reconnect)
     * - The Xero organization has been disconnected
     * - There are network/API issues with Xero
     * 
     * @param tenantId The tenant/organization ID whose Xero connection should be synced (required)
     * 
     * @return ResponseEntity with sync result or error:
     *         - Success (200 OK): Returns JSON with:
     *           {
     *             "success": true,
     *             "tenantId": "<tenant-id>",
     *             "tenantName": "<xero-tenant-name>",
     *             "message": "Tokens refreshed and connection verified"
     *           }
     *         - Error (500 Internal Server Error): Returns JSON with:
     *           {
     *             "success": false,
     *             "error": "<error-message>"
     *           }
     * 
     * @apiNote POST /api/sync?tenantId={tenantId}
     * 
     * @throws RuntimeException if:
     *         - Xero connection not found for the tenant
     *         - Token refresh fails (refresh token expired, invalid credentials, etc.)
     *         - Cannot verify connection with Xero API
     *         - Network or API errors occur
     * 
     * @example Request:
     * POST /api/sync?tenantId=tenant-abc-123
     * 
     * @example Success Response:
     * {
     *   "success": true,
     *   "tenantId": "tenant-abc-123",
     *   "tenantName": "Demo Company",
     *   "message": "Tokens refreshed and connection verified"
     * }
     * 
     * @example Error Response (Connection Not Found):
     * {
     *   "success": false,
     *   "error": "Xero connection not found for tenant: tenant-abc-123"
     * }
     * 
     * @example Error Response (Token Refresh Failed):
     * {
     *   "success": false,
     *   "error": "Failed to sync: Refresh token expired. Please reconnect to Xero."
     * }
     * 
     * @usage This endpoint should be called:
     *        - Periodically to keep tokens fresh (e.g., every 25 minutes)
     *        - Before making important Xero API calls
     *        - When troubleshooting connection issues
     *        - After reconnecting to Xero to verify the connection
     * 
     * @note If sync fails due to expired refresh token, the user will need to
     *       reconnect to Xero using the XeroAuthController.connect() endpoint.
     */
    @PostMapping
    public ResponseEntity<?> sync(@RequestParam String tenantId) {
        try {
            XeroConnection connection = xeroConnectionRepository.findByTenantId(tenantId)
                .orElseThrow(() -> new RuntimeException("Xero connection not found for tenant: " + tenantId));
            
            // Refresh tokens if needed
            connection = xeroOAuthService.refreshTokens(connection);
            
            // Verify connection is still valid by getting tenant info
            String accessToken = xeroOAuthService.getValidAccessToken(connection);
            Map<String, Object> tenantInfo = xeroOAuthService.getTenantInfo(accessToken);
            
            if (tenantInfo == null) {
                return ResponseEntity.status(500).body(Map.of(
                    "success", false,
                    "error", "Failed to verify connection with Xero"
                ));
            }
            
            return ResponseEntity.ok(Map.of(
                "success", true,
                "tenantId", tenantId,
                "tenantName", tenantInfo.get("Name"),
                "message", "Tokens refreshed and connection verified"
            ));
        } catch (Exception e) {
            log.error("Error syncing tenant {}", tenantId, e);
            return ResponseEntity.status(500).body(Map.of(
                "success", false,
                "error", "Failed to sync: " + e.getMessage()
            ));
        }
    }
}

