package com.prepaidly.controller;

import com.prepaidly.config.XeroConfig;
import com.prepaidly.dto.XeroConnectionResponse;
import com.prepaidly.dto.XeroConnectionStatusResponse;
import com.prepaidly.model.User;
import com.prepaidly.model.XeroConnection;
import com.prepaidly.repository.UserRepository;
import com.prepaidly.repository.XeroConnectionRepository;
import com.prepaidly.service.XeroOAuthService;
import com.prepaidly.service.TokenRefreshScheduler;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Xero Authentication Controller
 * 
 * REST controller for managing Xero OAuth2 authentication and connection management.
 * This controller handles the complete OAuth2 authorization flow for connecting Prepaidly
 * to Xero accounting software.
 * 
 * The OAuth2 flow consists of three main steps:
 * 1. Authorization: User is redirected to Xero to authorize the application
 * 2. Callback: Xero redirects back with an authorization code
 * 3. Token Exchange: Authorization code is exchanged for access and refresh tokens
 * 
 * Once connected, the system stores encrypted OAuth tokens (access token and refresh token)
 * associated with a tenant (Xero organization). These tokens are used to make API calls
 * to Xero on behalf of the connected organization.
 * 
 * Key Features:
 * - OAuth2 authorization flow initiation
 * - OAuth callback handling and token exchange
 * - Connection status checking
 * - Connection disconnection
 * - Configuration validation
 * 
 * Security Notes:
 * - OAuth tokens are encrypted before storage using Jasypt
 * - Access tokens expire after 30 minutes and must be refreshed
 * - Refresh tokens can be used to obtain new access tokens
 * - Multiple Xero organizations (tenants) can be connected per user
 * 
 * @apiNote All endpoints are under /api/auth/xero
 * 
 * @note In production, userId should come from authenticated session rather than
 *       request parameters. Currently uses DEFAULT_USER_ID for development.
 */
@Slf4j
@RestController
@RequestMapping("/api/auth/xero")
@RequiredArgsConstructor
public class XeroAuthController {

    private final XeroOAuthService xeroOAuthService;
    private final XeroConnectionRepository xeroConnectionRepository;
    private final UserRepository userRepository;
    private final TokenRefreshScheduler tokenRefreshScheduler;
    private final XeroConfig xeroConfig;
    
    @Value("${frontend.url:http://localhost:3000}")
    private String frontendUrl;
    
    // Temporary: For development, we'll use a default user ID
    // In production, this should come from authenticated session
    private static final Long DEFAULT_USER_ID = 1L;

    /**
     * Initiate Xero OAuth Connection
     * 
     * Starts the OAuth2 authorization flow by redirecting the user to Xero's
     * authorization page. The user will be prompted to:
     * - Log in to their Xero account
     * - Select which Xero organization(s) to connect
     * - Authorize the application to access their Xero data
     * 
     * After authorization, Xero redirects back to the callback endpoint with
     * an authorization code that can be exchanged for access tokens.
     * 
     * The authorization URL includes:
     * - Required OAuth scopes (accounting, offline_access)
     * - Client ID and redirect URI
     * - State parameter for CSRF protection (currently generated but not validated)
     * 
     * @param userId Optional user ID. If not provided, uses DEFAULT_USER_ID (development mode)
     * 
     * @return ResponseEntity that redirects to Xero authorization page:
     *         - Success (302 Found): Redirects to Xero authorization URL
     *         - Internal Server Error (500): Returns error if URL generation fails:
     *           {
     *             "error": "Failed to generate authorization URL: <error-message>"
     *           }
     * 
     * @apiNote GET /api/auth/xero/connect?userId={userId}
     * 
     * @throws IllegalStateException if Xero configuration is missing (client ID, secret, redirect URI)
     * 
     * @example Request:
     * GET /api/auth/xero/connect?userId=1
     * 
     * @example Response:
     * HTTP 302 Found
     * Location: https://login.xero.com/identity/connect/authorize?response_type=code&client_id=...
     * 
     * @usage This is the entry point for connecting to Xero. Users should be
     *        redirected to this endpoint when they click "Connect to Xero" in
     *        the frontend. The browser will be redirected to Xero for authorization.
     * 
     * @note The state parameter is generated but not currently validated in the
     *       callback. This should be implemented for production to prevent CSRF attacks.
     * 
     * @see XeroAuthController#callback(String, String, Long) for handling the OAuth callback
     */
    @GetMapping("/connect")
    public ResponseEntity<?> connect(@RequestParam(required = false) Long userId) {
        try {
            Long targetUserId = userId != null ? userId : DEFAULT_USER_ID;
            log.info("Xero connect request received for user: {}", targetUserId);
            String authUrl = xeroOAuthService.getAuthorizationUrl(targetUserId);
            
            log.info("Redirecting to Xero authorization URL");
            HttpHeaders headers = new HttpHeaders();
            headers.add("Location", authUrl);
            return ResponseEntity.status(HttpStatus.FOUND).headers(headers).build();
        } catch (Exception e) {
            log.error("Error generating authorization URL", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Failed to generate authorization URL: " + e.getMessage()));
        }
    }

    /**
     * OAuth Callback Handler
     * 
     * Handles the OAuth2 callback from Xero after user authorization. This endpoint:
     * 1. Receives the authorization code from Xero
     * 2. Exchanges the code for access and refresh tokens
     * 3. Retrieves connected Xero organizations (tenants)
     * 4. Stores encrypted tokens for each connected tenant
     * 5. Redirects the user back to the frontend with success/error status
     * 
     * The callback URL must match exactly what's configured in Xero app settings.
     * Default: http://localhost:8080/api/auth/xero/callback
     * 
     * After successful connection:
     * - OAuth tokens are encrypted and stored in the database
     * - Each connected Xero organization (tenant) gets its own connection record
     * - User is redirected to frontend success page with tenant information
     * 
     * @param code The authorization code from Xero (required)
     * @param state The state parameter from authorization request (optional, currently not validated)
     * @param userId Optional user ID. If not provided, uses DEFAULT_USER_ID (development mode)
     * 
     * @return ResponseEntity that redirects to frontend:
     *         - Success (302 Found): Redirects to frontend success page:
     *           Location: {frontendUrl}/app/connected?success=true&tenantId={tenantId}
     *           Body includes:
     *           {
     *             "success": true,
     *             "tenantId": "<xero-tenant-id>",
     *             "message": "Successfully connected to Xero"
     *           }
     *         - Error (500): Redirects to frontend error page:
     *           Location: {frontendUrl}/app/connected?success=false&error={encoded-error}
     *           Body includes:
     *           {
     *             "success": false,
     *             "error": "Failed to complete OAuth flow: <error-message>"
     *           }
     * 
     * @apiNote GET /api/auth/xero/callback?code={code}&state={state}&userId={userId}
     * 
     * @throws RuntimeException if:
     *         - Authorization code is invalid or expired
     *         - Token exchange fails
     *         - Cannot retrieve tenant information
     *         - Database operation fails
     * 
     * @example Request (from Xero redirect):
     * GET /api/auth/xero/callback?code=abc123xyz&state=random-state-value
     * 
     * @example Success Response:
     * HTTP 302 Found
     * Location: http://localhost:3000/app/connected?success=true&tenantId=tenant-abc-123
     * 
     * @example Error Response:
     * HTTP 500 Internal Server Error
     * Location: http://localhost:3000/app/connected?success=false&error=Failed%20to%20complete%20OAuth%20flow
     * 
     * @usage This endpoint is called automatically by Xero after user authorization.
     *        Users should not call this directly - it's part of the OAuth flow.
     * 
     * @note The authorization code is single-use and expires quickly (typically within
     *       10 minutes). If the callback is delayed, the code may be invalid.
     * 
     * @note In production, implement state parameter validation to prevent CSRF attacks.
     * 
     * @see XeroAuthController#connect(Long) for initiating the OAuth flow
     */
    @GetMapping("/callback")
    public ResponseEntity<?> callback(
            @RequestParam String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) Long userId) {
        try {
            Long targetUserId = userId != null ? userId : DEFAULT_USER_ID;
            
            // Validate state parameter is present
            if (state == null || state.isEmpty()) {
                log.error("OAuth callback missing state parameter for user {}", targetUserId);
                String errorRedirectUrl = frontendUrl + "/app/connected?success=false&error=" + 
                    java.net.URLEncoder.encode("Missing state parameter. This may indicate a security issue.", java.nio.charset.StandardCharsets.UTF_8);
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .header("Location", errorRedirectUrl)
                    .body(Map.of(
                        "success", false,
                        "error", "Missing state parameter. Please try connecting again."
                    ));
            }
            
            XeroConnection connection = xeroOAuthService.exchangeCodeForTokens(code, state, targetUserId);
            
            // Immediately trigger a token refresh to ensure the connection is active
            // This also helps verify the connection works and updates tenant name if needed
            try {
                log.info("Triggering immediate token refresh for newly connected tenant: {}", connection.getTenantId());
                tokenRefreshScheduler.refreshConnectionById(connection.getTenantId());
                log.info("Successfully refreshed tokens for new connection");
            } catch (Exception e) {
                // Don't fail the connection if refresh fails - it will be retried by scheduler
                log.warn("Could not immediately refresh tokens for new connection (will be retried by scheduler): {}", e.getMessage());
            }
            
            // Redirect to frontend success page
            String redirectUrl = frontendUrl + "/app/connected?success=true&tenantId=" + connection.getTenantId();
            log.info("Redirecting to frontend: {}", redirectUrl);
            return ResponseEntity.status(HttpStatus.FOUND)
                .header("Location", redirectUrl)
                .body(Map.of(
                    "success", true,
                    "tenantId", connection.getTenantId(),
                    "message", "Successfully connected to Xero"
                ));
        } catch (Exception e) {
            log.error("Error handling OAuth callback", e);
            String errorRedirectUrl = frontendUrl + "/app/connected?success=false&error=" + 
                java.net.URLEncoder.encode(e.getMessage(), java.nio.charset.StandardCharsets.UTF_8);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .header("Location", errorRedirectUrl)
                .body(Map.of(
                    "success", false,
                    "error", "Failed to complete OAuth flow: " + e.getMessage()
                ));
        }
    }

    /**
     * Check Xero Configuration
     * 
     * Validates and returns the current Xero OAuth configuration status. This endpoint
     * is useful for debugging and verifying that the Xero app credentials are properly
     * configured before attempting to connect.
     * 
     * Returns information about:
     * - Client ID (partially masked for security)
     * - Redirect URI configuration
     * - Whether client secret is configured (without exposing the secret)
     * - Frontend URL configuration
     * 
     * @return ResponseEntity with configuration details:
     *         {
     *           "clientId": "3C7D6D08...",  // First 8 chars + "..."
     *           "clientIdLength": 32,
     *           "redirectUri": "http://localhost:8080/api/auth/xero/callback",
     *           "hasClientSecret": true,
     *           "expectedRedirectUri": "http://localhost:8080/api/auth/xero/callback",
     *           "frontendUrl": "http://localhost:3000",
     *           "frontendUrlFromEnv": null
     *         }
     * 
     * @apiNote GET /api/auth/xero/config-check
     * 
     * @example Request:
     * GET /api/auth/xero/config-check
     * 
     * @example Success Response:
     * {
     *   "clientId": "3C7D6D08...",
     *   "clientIdLength": 32,
     *   "redirectUri": "http://localhost:8080/api/auth/xero/callback",
     *   "hasClientSecret": true,
     *   "expectedRedirectUri": "http://localhost:8080/api/auth/xero/callback",
     *   "frontendUrl": "http://localhost:3000",
     *   "frontendUrlFromEnv": null
     * }
     * 
     * @usage Use this endpoint to verify Xero configuration before attempting to connect.
     *        Useful for troubleshooting connection issues and ensuring all required
     *        credentials are properly set.
     * 
     * @note The client secret is never exposed - only a boolean indicating if it's configured.
     *       The client ID is partially masked for security.
     */
    @GetMapping("/config-check")
    public ResponseEntity<Map<String, Object>> configCheck() {
        Map<String, Object> config = new HashMap<>();
        String clientId = xeroConfig.getClientId();
        config.put("clientId", clientId != null && clientId.length() > 8 ? 
            clientId.substring(0, 8) + "..." : (clientId != null ? clientId : "NOT SET"));
        config.put("clientIdLength", clientId != null ? clientId.length() : 0);
        config.put("redirectUri", xeroConfig.getRedirectUri());
        config.put("hasClientSecret", xeroConfig.getClientSecret() != null && 
            !xeroConfig.getClientSecret().isEmpty());
        config.put("expectedRedirectUri", "http://localhost:8080/api/auth/xero/callback");
        config.put("frontendUrl", frontendUrl);
        config.put("frontendUrlFromEnv", System.getenv("FRONTEND_URL"));
        return ResponseEntity.ok(config);
    }

    /**
     * Get Xero Connection Status
     * 
     * Retrieves the connection status for all Xero organizations (tenants) connected
     * to a user. For each connection, the endpoint:
     * - Verifies the connection is still valid
     * - Refreshes tokens if needed
     * - Retrieves tenant information from Xero API
     * - Returns connection status and tenant details
     * 
     * The response includes:
     * - List of all connected Xero organizations
     * - Connection status (connected/disconnected)
     * - Tenant name and ID for each connection
     * - Any error messages for failed connections
     * 
     * Development Mode Behavior:
     * - If userId is null or DEFAULT_USER_ID, attempts to find user by email "demo@prepaidly.io"
     * - If default user not found, returns ALL connections (for development convenience)
     * - In production, should strictly filter by authenticated user
     * 
     * @param userId Optional user ID. If not provided:
     *               - Tries to find user with email "demo@prepaidly.io"
     *               - If not found, returns all connections (development mode)
     * 
     * @return ResponseEntity with connection status:
     *         - Success (200 OK): Returns XeroConnectionStatusResponse:
     *           {
     *             "connections": [
     *               {
     *                 "tenantId": "tenant-abc-123",
     *                 "tenantName": "Demo Company",
     *                 "connected": true,
     *                 "message": "Connected"
     *               },
     *               {
     *                 "tenantId": "tenant-xyz-789",
     *                 "tenantName": "Unknown",
     *                 "connected": false,
     *                 "message": "Error: Refresh token expired"
     *               }
     *             ],
     *             "totalConnections": 2
     *           }
     *         - Error (500): Returns empty response if status check fails
     * 
     * @apiNote GET /api/auth/xero/status?userId={userId}
     * 
     * @example Request:
     * GET /api/auth/xero/status?userId=1
     * 
     * @example Success Response:
     * {
     *   "connections": [
     *     {
     *       "tenantId": "tenant-abc-123",
     *       "tenantName": "Demo Company",
     *       "connected": true,
     *       "message": "Connected"
     *     }
     *   ],
     *   "totalConnections": 1
     * }
     * 
     * @usage Use this endpoint to:
     *        - Display connected Xero organizations in the UI
     *        - Check if connections are still valid
     *        - Show connection status before making API calls
     *        - Troubleshoot connection issues
     * 
     * @note This endpoint automatically refreshes tokens if they're expired or about to expire.
     *       Failed connections may indicate expired refresh tokens requiring reconnection.
     * 
     * @note In production, remove the development mode behavior that returns all connections.
     *       Always filter by authenticated user ID.
     */
    @GetMapping("/status")
    public ResponseEntity<XeroConnectionStatusResponse> status(@RequestParam(required = false) Long userId) {
        try {
            // Validate repositories are available
            if (userRepository == null) {
                log.error("UserRepository is null");
                throw new RuntimeException("UserRepository not initialized");
            }
            if (xeroConnectionRepository == null) {
                log.error("XeroConnectionRepository is null");
                throw new RuntimeException("XeroConnectionRepository not initialized");
            }
            
            // Debug: Log all users and connections
            List<User> allUsers = userRepository.findAll();
            log.info("Total users in database: {}", allUsers != null ? allUsers.size() : 0);
            if (allUsers != null) {
                for (User u : allUsers) {
                    if (u != null) {
                        log.info("User: ID={}, Email={}", u.getId(), u.getEmail());
                        List<XeroConnection> userConnections = xeroConnectionRepository.findByUserId(u.getId());
                        log.info("  Connections for user {}: {}", u.getId(), userConnections != null ? userConnections.size() : 0);
                        if (userConnections != null) {
                            for (XeroConnection conn : userConnections) {
                                if (conn != null) {
                                    log.info("    Connection: ID={}, TenantID={}", conn.getId(), conn.getTenantId());
                                }
                            }
                        }
                    }
                }
            }
            
            List<XeroConnection> connections;
            
            // For development: if userId is 1 or not provided, try to find user by email first
            // If not found, or if no userId specified, return ALL connections (for development convenience)
            if (userId == null || userId == DEFAULT_USER_ID) {
                User user = userRepository.findByEmail("demo@prepaidly.io").orElse(null);
                if (user != null) {
                    log.info("Using default user: {} (ID: {})", user.getEmail(), user.getId());
                    connections = xeroConnectionRepository.findByUserId(user.getId());
                } else {
                    // Development mode: if default user not found, return all connections
                    log.info("Default user not found, returning all connections for development");
                    connections = xeroConnectionRepository.findAll();
                }
            } else {
                User user = userRepository.findById(userId).orElse(null);
                if (user == null) {
                    log.warn("User not found with ID: {}", userId);
                    XeroConnectionStatusResponse emptyResponse = new XeroConnectionStatusResponse();
                    emptyResponse.setConnections(List.of());
                    emptyResponse.setTotalConnections(0);
                    return ResponseEntity.ok(emptyResponse);
                }
                connections = xeroConnectionRepository.findByUserId(user.getId());
            }
            
            log.info("Found {} total connections to process", connections.size());
            
            List<XeroConnectionResponse> connectionResponses = connections.stream()
                .map(conn -> {
                    try {
                        XeroConnectionResponse response = new XeroConnectionResponse();
                        response.setTenantId(conn.getTenantId());
                        
                        // Use stored tenant name first (this works even if tokens expire)
                        String storedTenantName = conn.getTenantName();
                        if (storedTenantName != null && !storedTenantName.trim().isEmpty()) {
                            response.setTenantName(storedTenantName);
                            log.info("Using stored tenant name: {} for tenantId: {}", storedTenantName, conn.getTenantId());
                        } else {
                            // Fallback to tenantId if no name stored
                            response.setTenantName(conn.getTenantId());
                            log.info("No stored tenant name, using tenantId: {}", conn.getTenantId());
                        }
                        
                        // Try to verify connection and refresh tenant name if possible
                        try {
                            String accessToken = xeroOAuthService.getValidAccessToken(conn);
                            response.setConnected(true);
                            response.setMessage("Connected");
                            
                            // Optionally update tenant name from API if we don't have one stored
                            if (storedTenantName == null || storedTenantName.trim().isEmpty()) {
                                Map<String, Object> tenantInfo = xeroOAuthService.getTenantInfo(accessToken, conn.getTenantId());
                                if (tenantInfo != null) {
                                    String apiTenantName = (String) tenantInfo.get("Name");
                                    if (apiTenantName != null && !apiTenantName.trim().isEmpty()) {
                                        response.setTenantName(apiTenantName);
                                        // Update stored name for future use
                                        conn.setTenantName(apiTenantName);
                                        xeroConnectionRepository.save(conn);
                                        log.info("Updated stored tenant name: {} for tenantId: {}", apiTenantName, conn.getTenantId());
                                    }
                                }
                            }
                        } catch (Exception e) {
                            log.warn("Connection check failed for tenantId {}: {} (tenant name still available from storage)", 
                                conn.getTenantId(), e.getMessage());
                            response.setConnected(false);
                            response.setMessage("Error: " + e.getMessage());
                            // Keep the stored tenant name even if connection check fails
                        }
                        return response;
                    } catch (Exception e) {
                        log.error("Error processing connection for tenantId {}: {}", conn.getTenantId(), e.getMessage(), e);
                        // Return a response with error status
                        XeroConnectionResponse errorResponse = new XeroConnectionResponse();
                        errorResponse.setTenantId(conn.getTenantId());
                        errorResponse.setTenantName(conn.getTenantName() != null ? conn.getTenantName() : conn.getTenantId());
                        errorResponse.setConnected(false);
                        errorResponse.setMessage("Error processing connection: " + e.getMessage());
                        return errorResponse;
                    }
                })
                .collect(Collectors.toList());
            
            XeroConnectionStatusResponse statusResponse = new XeroConnectionStatusResponse();
            statusResponse.setConnections(connectionResponses);
            statusResponse.setTotalConnections(connectionResponses.size());
            
            return ResponseEntity.ok(statusResponse);
        } catch (Exception e) {
            log.error("Error getting connection status", e);
            // Return error response with details for debugging
            XeroConnectionStatusResponse errorResponse = new XeroConnectionStatusResponse();
            errorResponse.setConnections(List.of());
            errorResponse.setTotalConnections(0);
            // Log the full stack trace for debugging
            log.error("Full stack trace:", e);
            // Return 200 OK with empty response instead of 500 to prevent frontend errors
            // The frontend can handle empty connections gracefully
            return ResponseEntity.ok(errorResponse);
        }
    }

    /**
     * Disconnect from Xero
     * 
     * Disconnects a Xero organization (tenant) by removing the stored OAuth connection.
     * This permanently deletes the connection record and encrypted tokens from the database.
     * 
     * After disconnection:
     * - The connection record is deleted
     * - Encrypted tokens are removed
     * - The tenant can no longer make API calls to Xero
     * - User will need to reconnect via the connect endpoint to restore access
     * 
     * Note: This does not revoke the OAuth tokens on Xero's side. To fully revoke
     * access, users should also disconnect the app from their Xero account settings.
     * 
     * @param tenantId The Xero tenant/organization ID to disconnect (required)
     * 
     * @return ResponseEntity with disconnection result:
     *         - Success (200 OK): Returns confirmation:
     *           {
     *             "success": true,
     *             "tenantId": "<tenant-id>",
     *             "message": "Successfully disconnected from Xero"
     *           }
     *         - Not Found (404): Returns error if connection doesn't exist:
     *           {
     *             "error": "Connection not found for tenant: <tenant-id>"
     *           }
     *         - Internal Server Error (500): Returns error if disconnection fails:
     *           {
     *             "error": "Failed to disconnect: <error-message>"
     *           }
     * 
     * @apiNote DELETE /api/auth/xero/disconnect?tenantId={tenantId}
     * 
     * @example Request:
     * DELETE /api/auth/xero/disconnect?tenantId=tenant-abc-123
     * 
     * @example Success Response:
     * {
     *   "success": true,
     *   "tenantId": "tenant-abc-123",
     *   "message": "Successfully disconnected from Xero"
     * }
     * 
     * @example Error Response (Not Found):
     * {
     *   "error": "Connection not found for tenant: tenant-abc-123"
     * }
     * 
     * @usage Use this endpoint when users want to disconnect a Xero organization.
     *        After disconnection, they'll need to reconnect via the connect endpoint
     *        to restore access to that organization.
     * 
     * @warning This is a permanent operation. The connection and tokens are deleted
     *          and cannot be recovered. Users will need to go through the full
     *          OAuth flow again to reconnect.
     * 
     * @note Consider adding authorization checks in production to ensure users can
     *       only disconnect their own connections.
     * 
     * @see XeroAuthController#connect(Long) for reconnecting after disconnection
     */
    @DeleteMapping("/disconnect")
    public ResponseEntity<?> disconnect(@RequestParam String tenantId) {
        try {
            XeroConnection connection = xeroConnectionRepository.findByTenantId(tenantId)
                .orElse(null);
            
            if (connection == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Connection not found for tenant: " + tenantId));
            }
            
            xeroConnectionRepository.delete(connection);
            log.info("Deleted Xero connection for tenant: {}", tenantId);
            
            return ResponseEntity.ok(Map.of(
                "success", true,
                "tenantId", tenantId,
                "message", "Successfully disconnected from Xero"
            ));
        } catch (Exception e) {
            log.error("Error disconnecting tenant {}", tenantId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Failed to disconnect: " + e.getMessage()));
        }
    }
}

