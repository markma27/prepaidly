package com.prepaidly.service;

import com.prepaidly.config.XeroConfig;
import com.prepaidly.model.User;
import com.prepaidly.model.XeroConnection;
import com.prepaidly.repository.UserRepository;
import com.prepaidly.repository.XeroConnectionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.*;

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
     */
    public String getAuthorizationUrl(Long userId) {
        String scopes = String.join(" ", XeroConfig.REQUIRED_SCOPES);
        String state = UUID.randomUUID().toString(); // TODO: Store state for validation
        
        return String.format(
            "%s?response_type=code&client_id=%s&redirect_uri=%s&scope=%s&state=%s",
            XeroConfig.XERO_AUTH_URL,
            xeroConfig.getClientId(),
            xeroConfig.getRedirectUri(),
            scopes,
            state
        );
    }
    
    /**
     * Exchange authorization code for access token
     */
    public XeroConnection exchangeCodeForTokens(String code, Long userId) {
        try {
            // Prepare token request
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
            headers.setBasicAuth(xeroConfig.getClientId(), xeroConfig.getClientSecret());
            
            MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
            body.add("grant_type", "authorization_code");
            body.add("code", code);
            body.add("redirect_uri", xeroConfig.getRedirectUri());
            
            HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(body, headers);
            
            // Call Xero token endpoint
            ResponseEntity<Map> response = restTemplate.postForEntity(
                XeroConfig.XERO_TOKEN_URL,
                request,
                Map.class
            );
            
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                Map<String, Object> tokenResponse = response.getBody();
                
                String accessToken = (String) tokenResponse.get("access_token");
                String refreshToken = (String) tokenResponse.get("refresh_token");
                Integer expiresIn = (Integer) tokenResponse.get("expires_in");
                
                // Get tenant information from the token response
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> tenants = (List<Map<String, Object>>) tokenResponse.get("tenant");
                
                if (tenants == null || tenants.isEmpty()) {
                    throw new RuntimeException("No tenant information in token response");
                }
                
                Map<String, Object> tenant = tenants.get(0);
                String tenantId = (String) tenant.get("tenantId");
                
                // Get or create user
                User user = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User not found: " + userId));
                
                // Check if connection already exists
                Optional<XeroConnection> existingConnection = 
                    xeroConnectionRepository.findByUserIdAndTenantId(userId, tenantId);
                
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
                connection.setExpiresAt(LocalDateTime.now().plusSeconds(expiresIn));
                
                return xeroConnectionRepository.save(connection);
            } else {
                throw new RuntimeException("Failed to exchange code for tokens: " + response.getStatusCode());
            }
        } catch (Exception e) {
            log.error("Error exchanging code for tokens", e);
            throw new RuntimeException("Failed to exchange authorization code for tokens", e);
        }
    }
    
    /**
     * Refresh access token using refresh token
     */
    public XeroConnection refreshTokens(XeroConnection connection) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
            headers.setBasicAuth(xeroConfig.getClientId(), xeroConfig.getClientSecret());
            
            MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
            body.add("grant_type", "refresh_token");
            body.add("refresh_token", encryptionService.decrypt(connection.getRefreshToken()));
            
            HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(body, headers);
            
            ResponseEntity<Map> response = restTemplate.postForEntity(
                XeroConfig.XERO_TOKEN_URL,
                request,
                Map.class
            );
            
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                Map<String, Object> tokenResponse = response.getBody();
                
                String accessToken = (String) tokenResponse.get("access_token");
                String refreshToken = (String) tokenResponse.get("refresh_token");
                Integer expiresIn = (Integer) tokenResponse.get("expires_in");
                
                connection.setAccessToken(encryptionService.encrypt(accessToken));
                connection.setRefreshToken(encryptionService.encrypt(refreshToken));
                connection.setExpiresAt(LocalDateTime.now().plusSeconds(expiresIn));
                
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
     * Get tenant information from Xero API
     */
    public Map<String, Object> getTenantInfo(String accessToken) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(accessToken);
            headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
            
            HttpEntity<String> entity = new HttpEntity<>(headers);
            ResponseEntity<Map> response = restTemplate.exchange(
                XeroConfig.XERO_API_URL + "/Organisation",
                HttpMethod.GET,
                entity,
                Map.class
            );
            
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> organisations = (List<Map<String, Object>>) response.getBody().get("Organisations");
                if (organisations != null && !organisations.isEmpty()) {
                    return organisations.get(0);
                }
            }
            return null;
        } catch (Exception e) {
            log.error("Error fetching tenant info", e);
            return null;
        }
    }
}

