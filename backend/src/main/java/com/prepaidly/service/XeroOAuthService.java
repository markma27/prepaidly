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
    
    /**
     * Generate the authorization URL for Xero OAuth2 flow
     * 
     * TODO [SECURITY]: Implement state parameter validation for CSRF protection
     * - Current: State is generated but not stored/validated
     * - Required: Store state in cache/session with userId and expiration (e.g., 10 minutes)
     * - In callback: Validate received state matches stored state for the user
     * - Benefits: Prevents CSRF attacks and ensures OAuth callback is legitimate
     * - Implementation: Use Redis/InMemoryCache or HttpSession to store state temporarily
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
        String state = UUID.randomUUID().toString(); // TODO: Store state for validation
        
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
     */
    @Transactional
    public XeroConnection exchangeCodeForTokens(String code, Long userId) {
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
            log.info("Exchanging authorization code for tokens. Code length: {}", code != null ? code.length() : 0);
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
                
                // Use the first connection (user selected tenant)
                Map<String, Object> xeroConnectionData = connections.get(0);
                String tenantId = (String) xeroConnectionData.get("tenantId");
                String tenantName = (String) xeroConnectionData.get("tenantName");
                
                log.info("Found connection - Tenant ID: {}, Tenant Name: {}", tenantId, tenantName);
                
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
                
                // Check if connection already exists (use actual user ID, not the default userId parameter)
                Optional<XeroConnection> existingConnection = 
                    xeroConnectionRepository.findByUserIdAndTenantId(user.getId(), tenantId);
                
                XeroConnection connection;
                if (existingConnection.isPresent()) {
                    connection = existingConnection.get();
                } else {
                    connection = new XeroConnection();
                    connection.setUser(user);
                    connection.setTenantId(tenantId);
                }
                
                // Encrypt and store tokens
                connection.setAccessToken(encryptionService.encrypt(accessToken));
                connection.setRefreshToken(encryptionService.encrypt(refreshToken));
                int expiresInSeconds = Objects.requireNonNull(expiresIn, "Expires in cannot be null");
                connection.setExpiresAt(LocalDateTime.now().plusSeconds(expiresInSeconds));
                
                return xeroConnectionRepository.save(connection);
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
     */
    @Transactional
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
     */
    public String getValidAccessToken(XeroConnection connection) {
        if (connection.getExpiresAt().isBefore(LocalDateTime.now().plusMinutes(5))) {
            // Token expires soon, refresh it
            connection = refreshTokens(connection);
        }
        return encryptionService.decrypt(connection.getAccessToken());
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
            }
            
            HttpEntity<String> entity = new HttpEntity<>(headers);
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                XeroConfig.XERO_API_URL + "/Organisation",
                Objects.requireNonNull(HttpMethod.GET),
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
            log.error("Error fetching tenant info for tenantId: {}", tenantId, e);
            return null;
        }
    }
}

