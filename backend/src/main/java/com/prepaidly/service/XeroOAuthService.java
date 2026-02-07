package com.prepaidly.service;

import com.prepaidly.config.XeroConfig;
import com.prepaidly.model.User;
import com.prepaidly.model.XeroConnection;
import com.prepaidly.repository.UserRepository;
import com.prepaidly.repository.XeroConnectionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.*;

/**
 * Xero OAuth2 Service
 * 
 * Handles the complete Xero OAuth2 lifecycle:
 * - Authorization URL generation (with offline_access scope for refresh tokens)
 * - Code-to-token exchange
 * - Token refresh with rotation (new refresh token replaces old on each refresh)
 * - Proactive token refresh (before expiry)
 * - invalid_grant detection (marks connection as DISCONNECTED)
 * - Connection status management
 * 
 * Xero token lifecycle notes:
 * - Access tokens expire after 30 minutes
 * - Refresh tokens expire after 60 days of inactivity
 * - Each refresh returns a NEW refresh token (rotation) that must replace the old one
 * - If a refresh token is used twice, the second use will fail (replay protection)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class XeroOAuthService {
    
    private final XeroConfig xeroConfig;
    private final EncryptionService encryptionService;
    private final UserRepository userRepository;
    private final XeroConnectionRepository xeroConnectionRepository;
    private final RestTemplate restTemplate;
    private final OAuthStateCache oAuthStateCache;

    /** Refresh buffer: refresh tokens if they expire within this many minutes */
    private static final int REFRESH_BUFFER_MINUTES = 5;
    
    /**
     * Custom exception thrown when a refresh token is invalid/expired/revoked.
     * Callers should mark the connection as DISCONNECTED and prompt re-authorization.
     */
    public static class InvalidGrantException extends RuntimeException {
        private final String tenantId;
        private final String errorDescription;

        public InvalidGrantException(String tenantId, String errorDescription) {
            super("Refresh token invalid for tenant " + tenantId + ": " + errorDescription);
            this.tenantId = tenantId;
            this.errorDescription = errorDescription;
        }

        public String getTenantId() { return tenantId; }
        public String getErrorDescription() { return errorDescription; }
    }
    
    /**
     * Generate the authorization URL for Xero OAuth2 flow.
     * 
     * Includes offline_access scope to receive a refresh token.
     * Scopes are defined in XeroConfig.REQUIRED_SCOPES.
     */
    public String getAuthorizationUrl(Long userId) {
        // Validate configuration
        if (xeroConfig.getClientId() == null || xeroConfig.getClientId().isEmpty()) {
            throw new IllegalStateException("Xero Client ID is not configured. Please check application-local.properties");
        }
        if (xeroConfig.getClientSecret() == null || xeroConfig.getClientSecret().isEmpty()) {
            throw new IllegalStateException("Xero Client Secret is not configured. Please check application-local.properties");
        }
        if (xeroConfig.getRedirectUri() == null || xeroConfig.getRedirectUri().isEmpty()) {
            throw new IllegalStateException("Xero Redirect URI is not configured. Please check application-local.properties");
        }
        
        // offline_access is included in REQUIRED_SCOPES to ensure we get a refresh token
        String scopes = String.join(" ", XeroConfig.REQUIRED_SCOPES);
        String state = oAuthStateCache.storeState(userId);
        
        String redirectUri = java.net.URLEncoder.encode(xeroConfig.getRedirectUri(), java.nio.charset.StandardCharsets.UTF_8);
        String encodedScopes = java.net.URLEncoder.encode(scopes, java.nio.charset.StandardCharsets.UTF_8);
        
        String authUrl = String.format(
            "%s?response_type=code&client_id=%s&redirect_uri=%s&scope=%s&state=%s",
            XeroConfig.XERO_AUTH_URL,
            xeroConfig.getClientId(),
            redirectUri,
            encodedScopes,
            state
        );
        
        log.info("Generated Xero authorization URL for user {} (scopes: {})", userId, scopes);
        
        return authUrl;
    }
    
    /**
     * Exchange authorization code for access and refresh tokens.
     * 
     * On success:
     * - Stores encrypted access_token + refresh_token per tenant
     * - Sets connection_status = CONNECTED
     * - Stores scopes and xero_connection_id
     * - Sets expires_at and last_refreshed_at
     */
    @Transactional
    public XeroConnection exchangeCodeForTokens(String code, String state, Long userId) {
        // Validate state parameter for CSRF protection
        if (!oAuthStateCache.validateState(state, userId)) {
            log.error("State validation failed for user {}. State: {}", userId, state);
            throw new RuntimeException("Invalid or expired state parameter. This may indicate a CSRF attack or expired OAuth flow. Please try connecting again.");
        }
        
        log.info("State validated successfully for user {}", userId);
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
            headers.setBasicAuth(
                Objects.requireNonNull(xeroConfig.getClientId(), "Client ID cannot be null"),
                Objects.requireNonNull(xeroConfig.getClientSecret(), "Client secret cannot be null")
            );
            
            MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
            body.add("grant_type", "authorization_code");
            body.add("code", code);
            body.add("redirect_uri", xeroConfig.getRedirectUri());
            
            HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(body, headers);
            
            log.info("Exchanging authorization code for tokens. Code length: {}, User ID: {}", 
                code != null ? code.length() : 0, userId);
            
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                XeroConfig.XERO_TOKEN_URL,
                HttpMethod.POST,
                request,
                new ParameterizedTypeReference<Map<String, Object>>() {}
            );
            
            Map<String, Object> tokenResponse = response.getBody();
            if (response.getStatusCode() == HttpStatus.OK && tokenResponse != null) {
                String accessToken = (String) tokenResponse.get("access_token");
                String refreshToken = (String) tokenResponse.get("refresh_token");
                String scopeStr = (String) tokenResponse.get("scope");
                Object expiresInObj = tokenResponse.get("expires_in");
                Integer expiresIn = expiresInObj instanceof Integer ? (Integer) expiresInObj : 
                    expiresInObj instanceof Long ? ((Long) expiresInObj).intValue() : null;
                
                if (accessToken == null) {
                    log.error("Access token is null in response");
                    throw new RuntimeException("Access token not found in token response");
                }
                if (refreshToken == null) {
                    log.warn("No refresh token in response - offline_access scope may be missing. Scopes granted: {}", scopeStr);
                }
                
                log.info("Successfully obtained tokens (refresh_token present: {}, scopes: {}). Fetching tenant connections...",
                    refreshToken != null, scopeStr);
                
                // Get tenant information from Xero Connections API
                List<Map<String, Object>> connections = getXeroConnections(accessToken);
                
                if (connections == null || connections.isEmpty()) {
                    log.error("No connections found for the authenticated user");
                    throw new RuntimeException("No Xero connections found. Please ensure you selected a tenant during authorization.");
                }
                
                log.info("Found {} Xero organization(s) to connect", connections.size());
                
                // Get or create user
                User user;
                Long userIdNonNull = Objects.requireNonNull(userId, "User ID cannot be null");
                if (userIdNonNull == 1L) {
                    user = userRepository.findByEmail("demo@prepaidly.io")
                        .orElseGet(() -> {
                            User newUser = new User();
                            newUser.setEmail("demo@prepaidly.io");
                            return userRepository.save(newUser);
                        });
                    log.info("Using default user: {} (ID: {})", user.getEmail(), user.getId());
                } else {
                    user = userRepository.findById(userIdNonNull)
                        .orElseThrow(() -> new RuntimeException("User not found: " + userIdNonNull));
                }
                
                XeroConnection firstConnection = null;
                int expiresInSeconds = Objects.requireNonNull(expiresIn, "Expires in cannot be null");
                List<String> savedTenantIds = new java.util.ArrayList<>();
                LocalDateTime now = LocalDateTime.now();
                
                for (int i = 0; i < connections.size(); i++) {
                    Map<String, Object> xeroConnectionData = connections.get(i);
                    String tenantId = (String) xeroConnectionData.get("tenantId");
                    String tenantName = (String) xeroConnectionData.get("tenantName");
                    String xeroConnId = (String) xeroConnectionData.get("id"); // Xero-side connection UUID
                    
                    log.info("[{}/{}] Processing connection - Tenant: {} ({}), xeroConnectionId: {}", 
                        i + 1, connections.size(), tenantName, tenantId, xeroConnId);
                    
                    Optional<XeroConnection> existingConnection = 
                        xeroConnectionRepository.findByUserIdAndTenantId(user.getId(), tenantId);
                    
                    XeroConnection connection;
                    boolean isNew = false;
                    if (existingConnection.isPresent()) {
                        connection = existingConnection.get();
                        log.info("[{}/{}] Updating existing connection for tenantId: {}", 
                            i + 1, connections.size(), tenantId);
                    } else {
                        connection = new XeroConnection();
                        connection.setUser(user);
                        connection.setTenantId(tenantId);
                        isNew = true;
                        log.info("[{}/{}] Creating new connection for tenantId: {}", 
                            i + 1, connections.size(), tenantId);
                    }
                    
                    // Store tenant name for display even when tokens expire
                    if (tenantName != null && !tenantName.trim().isEmpty()) {
                        connection.setTenantName(tenantName);
                    }
                    
                    // Encrypt and store tokens (same tokens for all connections from same OAuth flow)
                    connection.setAccessToken(encryptionService.encrypt(accessToken));
                    if (refreshToken != null) {
                        connection.setRefreshToken(encryptionService.encrypt(refreshToken));
                    }
                    connection.setExpiresAt(now.plusSeconds(expiresInSeconds));
                    
                    // Store new lifecycle fields
                    connection.markConnected(); // Set status=CONNECTED, clear disconnect_reason
                    connection.setScopes(scopeStr);
                    connection.setXeroConnectionId(xeroConnId);
                    connection.setLastRefreshedAt(now);
                    
                    try {
                        XeroConnection savedConnection = xeroConnectionRepository.saveAndFlush(connection);
                        savedTenantIds.add(tenantId);
                        log.info("[{}/{}] Successfully {} connection for tenant {} ({}), status=CONNECTED", 
                            i + 1, connections.size(), isNew ? "created" : "updated", 
                            tenantName, tenantId);
                        
                        if (firstConnection == null) {
                            firstConnection = savedConnection;
                        }
                    } catch (Exception e) {
                        log.error("[{}/{}] Failed to save connection for tenant {} ({}): {}", 
                            i + 1, connections.size(), tenantName, tenantId, e.getMessage());
                    }
                }
                
                if (firstConnection == null) {
                    throw new RuntimeException("Failed to save any connections");
                }
                
                log.info("Successfully processed {} connection(s). Saved tenantIds: {}", 
                    connections.size(), savedTenantIds);
                
                return firstConnection;
            } else {
                Map<String, Object> responseBody = response.getBody();
                String errorBody = responseBody != null ? responseBody.toString() : "No response body";
                log.error("Failed to exchange code for tokens. Status: {}, Body: {}", response.getStatusCode(), errorBody);
                throw new RuntimeException("Failed to exchange code for tokens: " + response.getStatusCode());
            }
        } catch (HttpClientErrorException e) {
            log.error("HTTP error exchanging code for tokens. Status: {}, Response: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new RuntimeException("Failed to exchange authorization code: " + e.getStatusCode() + ". " + e.getResponseBodyAsString(), e);
        } catch (Exception e) {
            if (e instanceof RuntimeException) throw (RuntimeException) e;
            log.error("Error exchanging code for tokens", e);
            throw new RuntimeException("Failed to exchange authorization code: " + e.getMessage(), e);
        }
    }
    
    /**
     * Refresh access token using refresh token (with rotation).
     * 
     * Xero uses refresh token rotation: each successful refresh returns a NEW refresh token.
     * The old refresh token is invalidated. Both tokens must be stored.
     * 
     * If the refresh fails with invalid_grant (expired/revoked/stale refresh token),
     * this method marks the connection as DISCONNECTED and throws InvalidGrantException.
     * 
     * Uses REQUIRES_NEW transaction to prevent rollback issues.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW, rollbackFor = Exception.class)
    public XeroConnection refreshTokens(XeroConnection connection) {
        String tenantId = connection.getTenantId();
        String tenantName = connection.getTenantName() != null ? connection.getTenantName() : tenantId;
        
        log.info("Refreshing tokens for tenant: {} ({})", tenantName, tenantId);
        
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
            headers.setBasicAuth(
                Objects.requireNonNull(xeroConfig.getClientId(), "Client ID cannot be null"),
                Objects.requireNonNull(xeroConfig.getClientSecret(), "Client secret cannot be null")
            );
            
            MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
            body.add("grant_type", "refresh_token");
            body.add("refresh_token", encryptionService.decrypt(connection.getRefreshToken()));
            
            HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(body, headers);
            
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                XeroConfig.XERO_TOKEN_URL,
                HttpMethod.POST,
                request,
                new ParameterizedTypeReference<Map<String, Object>>() {}
            );
            
            Map<String, Object> tokenResponse = response.getBody();
            if (response.getStatusCode() == HttpStatus.OK && tokenResponse != null) {
                String newAccessToken = (String) tokenResponse.get("access_token");
                String newRefreshToken = (String) tokenResponse.get("refresh_token");
                Object expiresInObj = tokenResponse.get("expires_in");
                Integer expiresIn = expiresInObj instanceof Integer ? (Integer) expiresInObj : 
                    expiresInObj instanceof Long ? ((Long) expiresInObj).intValue() : null;
                
                // CRITICAL: Store BOTH new access token AND new refresh token (rotation)
                connection.setAccessToken(encryptionService.encrypt(newAccessToken));
                if (newRefreshToken != null) {
                    connection.setRefreshToken(encryptionService.encrypt(newRefreshToken));
                    log.debug("Refresh token rotated for tenant: {}", tenantId);
                } else {
                    log.warn("No new refresh token returned for tenant: {} - keeping existing refresh token", tenantId);
                }
                
                int expiresInSeconds = Objects.requireNonNull(expiresIn, "Expires in cannot be null");
                LocalDateTime now = LocalDateTime.now();
                connection.setExpiresAt(now.plusSeconds(expiresInSeconds));
                connection.setLastRefreshedAt(now);
                
                // Ensure connection is marked as connected after successful refresh
                connection.markConnected();
                
                XeroConnection saved = xeroConnectionRepository.save(connection);
                log.info("Token refresh successful for tenant: {} ({}). New expiry: {}, status: CONNECTED", 
                    tenantName, tenantId, saved.getExpiresAt());
                
                return saved;
            } else {
                throw new RuntimeException("Failed to refresh tokens: HTTP " + response.getStatusCode());
            }
        } catch (HttpClientErrorException e) {
            String responseBody = e.getResponseBodyAsString();
            int statusCode = e.getStatusCode().value();
            
            // Check for invalid_grant - means refresh token is expired/revoked/stale
            boolean isInvalidGrant = responseBody != null && responseBody.contains("invalid_grant");
            // Also treat 400 with "unauthorized_client" as invalid grant
            boolean isUnauthorizedClient = responseBody != null && responseBody.contains("unauthorized_client");
            
            if (isInvalidGrant || isUnauthorizedClient || statusCode == 400 || statusCode == 401) {
                String reason = isInvalidGrant ? "invalid_grant" :
                                isUnauthorizedClient ? "unauthorized_client" :
                                "token_refresh_failed_" + statusCode;
                
                log.error("Token refresh failed for tenant {} ({}): {} - marking as DISCONNECTED. " +
                          "User must re-authorize. HTTP {}, response: [redacted]",
                    tenantName, tenantId, reason, statusCode);
                
                // Mark connection as DISCONNECTED in a way that persists even if outer transaction rolls back
                markConnectionDisconnected(connection.getId(), reason);
                
                throw new InvalidGrantException(tenantId, reason);
            }
            
            // Other HTTP errors (rate limit, server error, etc.) - don't disconnect, just fail
            log.error("Token refresh HTTP error for tenant {} ({}): HTTP {}. Response: [redacted]",
                tenantName, tenantId, statusCode);
            throw new RuntimeException("Failed to refresh tokens: HTTP " + statusCode, e);
        } catch (InvalidGrantException e) {
            throw e; // Re-throw our custom exception
        } catch (Exception e) {
            log.error("Token refresh error for tenant {}: {}", tenantId, e.getMessage());
            throw new RuntimeException("Failed to refresh tokens: " + e.getMessage(), e);
        }
    }

    /**
     * Mark a connection as DISCONNECTED in a separate transaction.
     * This ensures the disconnect status is persisted even if the calling transaction rolls back.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markConnectionDisconnected(Long connectionId, String reason) {
        try {
            xeroConnectionRepository.findById(connectionId).ifPresent(conn -> {
                conn.markDisconnected(reason);
                xeroConnectionRepository.save(conn);
                log.info("Marked connection {} (tenant: {}) as DISCONNECTED. Reason: {}", 
                    connectionId, conn.getTenantId(), reason);
            });
        } catch (Exception e) {
            log.error("Failed to mark connection {} as disconnected: {}", connectionId, e.getMessage());
        }
    }
    
    /**
     * Get valid access token, refreshing proactively if needed.
     * 
     * Refresh strategy:
     * - If token expires within REFRESH_BUFFER_MINUTES (5 min), refresh first
     * - If connection is DISCONNECTED, throw immediately (user must re-authorize)
     * - On refresh failure with invalid_grant, mark DISCONNECTED and throw
     */
    public String getValidAccessToken(XeroConnection connection) {
        // If connection is already marked as DISCONNECTED, don't even try
        if (!connection.isConnected()) {
            log.warn("Cannot get access token for DISCONNECTED tenant: {} (reason: {})", 
                connection.getTenantId(), connection.getDisconnectReason());
            throw new RuntimeException("Connection is disconnected for tenant " + connection.getTenantId() + 
                ". Reason: " + connection.getDisconnectReason() + ". Please re-authorize.");
        }
        
        try {
            LocalDateTime now = LocalDateTime.now();
            LocalDateTime expiresAt = connection.getExpiresAt();
            
            // Refresh if token is expired or expires within buffer period
            if (expiresAt == null || expiresAt.isBefore(now.plusMinutes(REFRESH_BUFFER_MINUTES))) {
                log.info("Token for tenant {} expires at {} (within {} min buffer), refreshing...", 
                    connection.getTenantId(), expiresAt, REFRESH_BUFFER_MINUTES);
                connection = refreshTokens(connection);
                log.info("Token refreshed for tenant {}, new expiresAt: {}", 
                    connection.getTenantId(), connection.getExpiresAt());
            }
            return encryptionService.decrypt(connection.getAccessToken());
        } catch (InvalidGrantException e) {
            // Already marked as disconnected by refreshTokens
            throw new RuntimeException("Refresh token expired/revoked for tenant " + connection.getTenantId() + 
                ". Please re-authorize.", e);
        } catch (Exception e) {
            log.error("Failed to get valid access token for tenant {}: {}", 
                connection.getTenantId(), e.getMessage());
            throw new RuntimeException("Failed to get valid access token: " + e.getMessage(), e);
        }
    }

    /**
     * Attempt to verify a connection is still valid by calling Xero /connections endpoint.
     * Returns true if the connection is alive, false otherwise.
     * Does NOT throw - safe for status checking.
     */
    public boolean verifyConnection(XeroConnection connection) {
        if (!connection.isConnected()) {
            return false;
        }
        try {
            String accessToken = getValidAccessToken(connection);
            List<Map<String, Object>> xeroConnections = getXeroConnections(accessToken);
            // Check that our tenantId is still in the list
            boolean found = xeroConnections.stream()
                .anyMatch(c -> connection.getTenantId().equals(c.get("tenantId")));
            if (!found) {
                log.warn("Tenant {} not found in Xero /connections response - may have been removed", 
                    connection.getTenantId());
            }
            return found;
        } catch (Exception e) {
            log.debug("Connection verification failed for tenant {}: {}", 
                connection.getTenantId(), e.getMessage());
            return false;
        }
    }
    
    /**
     * Get Xero connections (tenants) for the authenticated user
     */
    private List<Map<String, Object>> getXeroConnections(String accessToken) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(Objects.requireNonNull(accessToken, "Access token cannot be null"));
            headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
            
            HttpEntity<String> entity = new HttpEntity<>(headers);
            ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                "https://api.xero.com/connections",
                HttpMethod.GET,
                entity,
                new ParameterizedTypeReference<List<Map<String, Object>>>() {}
            );
            
            List<Map<String, Object>> responseBody = response.getBody();
            if (response.getStatusCode() == HttpStatus.OK && responseBody != null) {
                return responseBody;
            }
            return Collections.emptyList();
        } catch (Exception e) {
            log.error("Error fetching Xero connections: {}", e.getMessage());
            throw new RuntimeException("Failed to fetch Xero connections: " + e.getMessage(), e);
        }
    }
    
    /**
     * Disconnect from Xero by revoking the connection on Xero's side.
     */
    public boolean disconnectFromXero(XeroConnection connection) {
        try {
            String accessToken = getValidAccessToken(connection);
            
            List<Map<String, Object>> allConnections = getXeroConnections(accessToken);
            
            String connectionId = null;
            for (Map<String, Object> conn : allConnections) {
                String tenantId = (String) conn.get("tenantId");
                if (tenantId != null && tenantId.equals(connection.getTenantId())) {
                    connectionId = (String) conn.get("id");
                    break;
                }
            }
            
            if (connectionId == null) {
                log.warn("Connection ID not found for tenantId: {}. May already be disconnected.", 
                    connection.getTenantId());
                return false;
            }
            
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(accessToken);
            headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
            
            HttpEntity<String> entity = new HttpEntity<>(headers);
            ResponseEntity<Void> response = restTemplate.exchange(
                "https://api.xero.com/connections/" + connectionId,
                HttpMethod.DELETE,
                entity,
                Void.class
            );
            
            if (response.getStatusCode() == HttpStatus.NO_CONTENT || response.getStatusCode() == HttpStatus.OK) {
                log.info("Successfully disconnected from Xero for tenantId: {}, connectionId: {}", 
                    connection.getTenantId(), connectionId);
                return true;
            } else {
                log.warn("Unexpected status disconnecting from Xero: {} for tenantId: {}", 
                    response.getStatusCode(), connection.getTenantId());
                return false;
            }
        } catch (Exception e) {
            log.error("Error disconnecting from Xero for tenantId: {}: {}", 
                connection.getTenantId(), e.getMessage());
            return false;
        }
    }
    
    /**
     * Get tenant information from Xero API
     */
    public Map<String, Object> getTenantInfo(String accessToken) {
        return getTenantInfo(accessToken, null);
    }
    
    public Map<String, Object> getTenantInfo(String accessToken, String tenantId) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(Objects.requireNonNull(accessToken, "Access token cannot be null"));
            headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
            if (tenantId != null) {
                headers.set("xero-tenant-id", tenantId);
            }
            
            HttpEntity<String> entity = new HttpEntity<>(headers);
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                XeroConfig.XERO_API_URL + "/Organisation",
                HttpMethod.GET,
                entity,
                new ParameterizedTypeReference<Map<String, Object>>() {}
            );
            
            Map<String, Object> responseBody = response.getBody();
            if (response.getStatusCode() == HttpStatus.OK && responseBody != null) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> organisations = (List<Map<String, Object>>) responseBody.get("Organisations");
                if (organisations != null && !organisations.isEmpty()) {
                    return organisations.get(0);
                }
            }
            return null;
        } catch (Exception e) {
            log.error("Error fetching tenant info for tenantId: {}: {}", tenantId, e.getMessage());
            return null;
        }
    }
}

