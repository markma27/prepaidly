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
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.*;
import java.util.Objects;

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
    
    /**
     * Generate the authorization URL for Xero OAuth2 flow
     * 
     * Generates a secure authorization URL with state parameter for CSRF protection.
     * The state is stored in cache and associated with the user ID. It will be validated
     * in the OAuth callback to ensure the request is legitimate.
     * 
     * Security Features:
     * - State parameter is generated and stored with user ID
     * - State expires after 10 minutes
     * - State is validated in callback to prevent CSRF attacks
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
        
        String scopes = String.join(" ", XeroConfig.REQUIRED_SCOPES);
        // Generate and store state for CSRF protection
        String state = oAuthStateCache.storeState(userId);
        
        // URL encode the redirect URI and scopes
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
        
        log.info("Generated Xero authorization URL for user {}: {}", userId, authUrl);
        log.info("Xero Config - Client ID: {}, Redirect URI: {}", xeroConfig.getClientId(), xeroConfig.getRedirectUri());
        
        return authUrl;
    }
    
    /**
     * Exchange authorization code for access token
     * 
     * Validates the state parameter for CSRF protection before exchanging the code.
     * 
     * @param code The authorization code from Xero
     * @param state The state parameter from OAuth callback (must match stored state)
     * @param userId The user ID associated with this OAuth flow
     * @return XeroConnection with encrypted tokens
     * @throws RuntimeException if state validation fails or token exchange fails
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
            // Prepare token request
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
            
            // Call Xero token endpoint
            log.info("Exchanging authorization code for tokens. Code length: {}, User ID: {}", 
                code != null ? code.length() : 0, userId);
            log.info("Using redirect URI: {}", xeroConfig.getRedirectUri());
            
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                XeroConfig.XERO_TOKEN_URL,
                Objects.requireNonNull(HttpMethod.POST),
                request,
                new ParameterizedTypeReference<Map<String, Object>>() {}
            );
            
            log.info("Token exchange response status: {}", response.getStatusCode());
            
            Map<String, Object> tokenResponse = response.getBody();
            if (response.getStatusCode() == HttpStatus.OK && tokenResponse != null) {
                log.info("Token response keys: {}", tokenResponse.keySet());
                
                String accessToken = (String) tokenResponse.get("access_token");
                String refreshToken = (String) tokenResponse.get("refresh_token");
                Object expiresInObj = tokenResponse.get("expires_in");
                Integer expiresIn = expiresInObj instanceof Integer ? (Integer) expiresInObj : 
                    expiresInObj instanceof Long ? ((Long) expiresInObj).intValue() : null;
                
                if (accessToken == null) {
                    log.error("Access token is null in response. Full response: {}", tokenResponse);
                    throw new RuntimeException("Access token not found in token response");
                }
                
                log.info("Successfully obtained access token. Now fetching tenant connections...");
                
                // Get tenant information from Xero Connections API
                // Note: Token response doesn't include tenant info, need to call /connections endpoint
                List<Map<String, Object>> connections = getXeroConnections(accessToken);
                
                if (connections == null || connections.isEmpty()) {
                    log.error("No connections found for the authenticated user");
                    throw new RuntimeException("No Xero connections found. Please ensure you selected a tenant during authorization.");
                }
                
                log.info("Found {} Xero organization(s) to connect", connections.size());
                for (int i = 0; i < connections.size(); i++) {
                    Map<String, Object> conn = connections.get(i);
                    log.info("  Connection {}: tenantId={}, tenantName={}", 
                        i + 1, conn.get("tenantId"), conn.get("tenantName"));
                }
                
                // Get or create user
                // For development: if userId is 1, try to find default user by email first
                User user;
                Long userIdNonNull = Objects.requireNonNull(userId, "User ID cannot be null");
                if (userIdNonNull == 1L) {
                    user = userRepository.findByEmail("demo@prepaidly.io")
                        .orElseGet(() -> {
                            // Create default user if not exists
                            User newUser = new User();
                            newUser.setEmail("demo@prepaidly.io");
                            return userRepository.save(newUser);
                        });
                    log.info("Using default user: {} (ID: {})", user.getEmail(), user.getId());
                } else {
                    user = userRepository.findById(userIdNonNull)
                        .orElseThrow(() -> new RuntimeException("User not found: " + userIdNonNull));
                }
                
                // Process ALL connections (not just the first one)
                // When user selects multiple organizations in Xero, we need to save all of them
                XeroConnection firstConnection = null;
                int expiresInSeconds = Objects.requireNonNull(expiresIn, "Expires in cannot be null");
                List<String> savedTenantIds = new java.util.ArrayList<>();
                
                for (int i = 0; i < connections.size(); i++) {
                    Map<String, Object> xeroConnectionData = connections.get(i);
                    String tenantId = (String) xeroConnectionData.get("tenantId");
                    String tenantName = (String) xeroConnectionData.get("tenantName");
                    
                    log.info("[{}/{}] Processing connection - Tenant ID: {}, Tenant Name: {}", 
                        i + 1, connections.size(), tenantId, tenantName);
                    
                    // Check if connection already exists (use actual user ID, not the default userId parameter)
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
                        log.info("[{}/{}] Storing tenant name: {} for tenantId: {}", 
                            i + 1, connections.size(), tenantName, tenantId);
                    }
                    
                    // Encrypt and store tokens (same tokens for all connections from same OAuth flow)
                    connection.setAccessToken(encryptionService.encrypt(accessToken));
                    connection.setRefreshToken(encryptionService.encrypt(refreshToken));
                    connection.setExpiresAt(LocalDateTime.now().plusSeconds(expiresInSeconds));
                    
                    try {
                        // Use saveAndFlush to ensure immediate commit (important for multiple connections)
                        XeroConnection savedConnection = xeroConnectionRepository.saveAndFlush(connection);
                        savedTenantIds.add(tenantId);
                        log.info("[{}/{}] Successfully {} connection for tenantId: {}, tenantName: {}, connectionId: {}", 
                            i + 1, connections.size(), isNew ? "created" : "updated", 
                            tenantId, tenantName, savedConnection.getId());
                        
                        // Keep track of first connection for return value (backward compatibility)
                        if (firstConnection == null) {
                            firstConnection = savedConnection;
                        }
                    } catch (Exception e) {
                        log.error("[{}/{}] Failed to save connection for tenantId: {}, tenantName: {}", 
                            i + 1, connections.size(), tenantId, tenantName, e);
                        // Don't throw immediately - try to save remaining connections
                        // But log the error so we know which ones failed
                        log.error("Error details for tenantId {}: {}", tenantId, e.getMessage(), e);
                        // Continue with next connection instead of failing all
                        // We'll check at the end if we saved at least one
                    }
                }
                
                if (firstConnection == null) {
                    throw new RuntimeException("Failed to save any connections");
                }
                
                log.info("Successfully processed {} connection(s). Saved tenantIds: {}. Returning first connection: {}", 
                    connections.size(), savedTenantIds, firstConnection.getTenantId());
                
                return firstConnection;
            } else {
                Map<String, Object> responseBody = response.getBody();
                String errorBody = responseBody != null ? responseBody.toString() : "No response body";
                log.error("Failed to exchange code for tokens. Status: {}, Body: {}", response.getStatusCode(), errorBody);
                throw new RuntimeException("Failed to exchange code for tokens: " + response.getStatusCode() + ". Response: " + errorBody);
            }
        } catch (org.springframework.web.client.HttpClientErrorException e) {
            log.error("HTTP error exchanging code for tokens. Status: {}, Response body: {}", e.getStatusCode(), e.getResponseBodyAsString(), e);
            throw new RuntimeException("Failed to exchange authorization code for tokens: " + e.getStatusCode() + ". " + e.getResponseBodyAsString(), e);
        } catch (Exception e) {
            log.error("Error exchanging code for tokens", e);
            throw new RuntimeException("Failed to exchange authorization code for tokens: " + e.getMessage(), e);
        }
    }
    
    /**
     * Refresh access token using refresh token
     * Uses REQUIRES_NEW to ensure it runs in its own transaction,
     * preventing transaction abort issues when refresh fails
     */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW, rollbackFor = Exception.class)
    public XeroConnection refreshTokens(XeroConnection connection) {
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
                Objects.requireNonNull(HttpMethod.POST),
                request,
                new ParameterizedTypeReference<Map<String, Object>>() {}
            );
            
            Map<String, Object> tokenResponse = response.getBody();
            if (response.getStatusCode() == HttpStatus.OK && tokenResponse != null) {
                String accessToken = (String) tokenResponse.get("access_token");
                String refreshToken = (String) tokenResponse.get("refresh_token");
                Object expiresInObj = tokenResponse.get("expires_in");
                Integer expiresIn = expiresInObj instanceof Integer ? (Integer) expiresInObj : 
                    expiresInObj instanceof Long ? ((Long) expiresInObj).intValue() : null;
                
                connection.setAccessToken(encryptionService.encrypt(accessToken));
                connection.setRefreshToken(encryptionService.encrypt(refreshToken));
                int expiresInSeconds = Objects.requireNonNull(expiresIn, "Expires in cannot be null");
                connection.setExpiresAt(LocalDateTime.now().plusSeconds(expiresInSeconds));
                
                return xeroConnectionRepository.save(connection);
            } else {
                throw new RuntimeException("Failed to refresh tokens: " + response.getStatusCode());
            }
        } catch (Exception e) {
            log.error("Error refreshing tokens", e);
            throw new RuntimeException("Failed to refresh tokens", e);
        }
    }
    
    /**
     * Get valid access token (refresh if needed)
     * 
     * This method handles token refresh. If refresh fails, it throws an exception immediately.
     * The refreshTokens method uses REQUIRES_NEW propagation to ensure it runs in its own
     * transaction, preventing transaction abort issues.
     */
    public String getValidAccessToken(XeroConnection connection) {
        try {
            if (connection.getExpiresAt().isBefore(LocalDateTime.now().plusMinutes(5))) {
                // Token expires soon, refresh it
                // refreshTokens uses REQUIRES_NEW so it runs in its own transaction
                connection = refreshTokens(connection);
            }
            return encryptionService.decrypt(connection.getAccessToken());
        } catch (Exception e) {
            log.error("Failed to get valid access token for tenant {}", connection.getTenantId(), e);
            throw new RuntimeException("Failed to get valid access token: " + e.getMessage(), e);
        }
    }
    
    
    /**
     * Get Xero connections (tenants) for the authenticated user
     */
    private List<Map<String, Object>> getXeroConnections(String accessToken) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(Objects.requireNonNull(accessToken, "Access token cannot be null"));
            headers.setAccept(Objects.requireNonNull(Collections.singletonList(MediaType.APPLICATION_JSON)));
            
            HttpEntity<String> entity = new HttpEntity<>(headers);
            ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                "https://api.xero.com/connections",
                Objects.requireNonNull(HttpMethod.GET),
                entity,
                new ParameterizedTypeReference<List<Map<String, Object>>>() {}
            );
            
            List<Map<String, Object>> responseBody = response.getBody();
            if (response.getStatusCode() == HttpStatus.OK && responseBody != null) {
                return responseBody;
            }
            return Collections.emptyList();
        } catch (Exception e) {
            log.error("Error fetching Xero connections", e);
            throw new RuntimeException("Failed to fetch Xero connections: " + e.getMessage(), e);
        }
    }
    
    /**
     * Disconnect from Xero by revoking the connection on Xero's side
     * 
     * This method calls Xero's API to remove the connection, which will revoke
     * access tokens and remove the app from the organization's connected apps list.
     * 
     * @param connection The XeroConnection to disconnect
     * @return true if disconnection was successful, false otherwise
     */
    public boolean disconnectFromXero(XeroConnection connection) {
        try {
            // Get a valid access token (will refresh if needed)
            String accessToken = getValidAccessToken(connection);
            
            // Get all connections to find the connectionId for this tenant
            List<Map<String, Object>> allConnections = getXeroConnections(accessToken);
            
            // Find the connection that matches our tenantId
            String connectionId = null;
            for (Map<String, Object> conn : allConnections) {
                String tenantId = (String) conn.get("tenantId");
                if (tenantId != null && tenantId.equals(connection.getTenantId())) {
                    connectionId = (String) conn.get("id");
                    break;
                }
            }
            
            if (connectionId == null) {
                log.warn("Connection ID not found for tenantId: {}. Connection may already be disconnected in Xero.", 
                    connection.getTenantId());
                // Connection might already be removed from Xero, but we'll still delete from our DB
                return false;
            }
            
            // Delete the connection from Xero
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(Objects.requireNonNull(accessToken, "Access token cannot be null"));
            headers.setAccept(Objects.requireNonNull(Collections.singletonList(MediaType.APPLICATION_JSON)));
            
            HttpEntity<String> entity = new HttpEntity<>(headers);
            ResponseEntity<Void> response = restTemplate.exchange(
                "https://api.xero.com/connections/" + connectionId,
                Objects.requireNonNull(HttpMethod.DELETE),
                entity,
                Void.class
            );
            
            if (response.getStatusCode() == HttpStatus.NO_CONTENT || response.getStatusCode() == HttpStatus.OK) {
                log.info("Successfully disconnected from Xero for tenantId: {}, connectionId: {}", 
                    connection.getTenantId(), connectionId);
                return true;
            } else {
                log.warn("Unexpected status code when disconnecting from Xero: {} for tenantId: {}", 
                    response.getStatusCode(), connection.getTenantId());
                return false;
            }
        } catch (Exception e) {
            log.error("Error disconnecting from Xero for tenantId: {}", connection.getTenantId(), e);
            // Don't throw - we'll still delete from our database even if Xero disconnect fails
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
            headers.setAccept(Objects.requireNonNull(Collections.singletonList(MediaType.APPLICATION_JSON)));
            if (tenantId != null) {
                headers.set("xero-tenant-id", tenantId);
                log.debug("Fetching tenant info for tenantId: {}", tenantId);
            }
            
            HttpEntity<String> entity = new HttpEntity<>(headers);
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                XeroConfig.XERO_API_URL + "/Organisation",
                Objects.requireNonNull(HttpMethod.GET),
                entity,
                new ParameterizedTypeReference<Map<String, Object>>() {}
            );
            
            Map<String, Object> responseBody = response.getBody();
            log.debug("Xero API response status: {}, body: {}", response.getStatusCode(), responseBody);
            
            if (response.getStatusCode() == HttpStatus.OK && responseBody != null) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> organisations = (List<Map<String, Object>>) responseBody.get("Organisations");
                if (organisations != null && !organisations.isEmpty()) {
                    Map<String, Object> org = organisations.get(0);
                    log.debug("Found organisation: {}", org);
                    String orgName = (String) org.get("Name");
                    log.info("Tenant name for tenantId {}: {}", tenantId, orgName);
                    return org;
                } else {
                    log.warn("No organisations found in response for tenantId: {}", tenantId);
                }
            } else {
                log.warn("Invalid response status or body for tenantId: {}, status: {}, body: {}", 
                    tenantId, response.getStatusCode(), responseBody);
            }
            return null;
        } catch (Exception e) {
            log.error("Error fetching tenant info for tenantId: {}", tenantId, e);
            return null;
        }
    }
}

