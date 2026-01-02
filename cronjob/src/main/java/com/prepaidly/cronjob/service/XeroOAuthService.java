package com.prepaidly.cronjob.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prepaidly.model.XeroConnection;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Base64;

/**
 * Service for managing Xero OAuth2 tokens.
 * Handles token refresh when access tokens expire.
 */
public class XeroOAuthService {
    private static final Logger log = LoggerFactory.getLogger(XeroOAuthService.class);
    
    private static final String XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
    
    private final String clientId;
    private final String clientSecret;
    private final EncryptionService encryptionService;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    
    public XeroOAuthService(String clientId, String clientSecret, EncryptionService encryptionService) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.encryptionService = encryptionService;
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();
        this.objectMapper = new ObjectMapper();
        
        log.info("XeroOAuthService initialized");
    }
    
    /**
     * Get a valid access token, refreshing if necessary.
     * 
     * @param connection The Xero connection
     * @return Valid access token
     * @throws RuntimeException if token refresh fails
     */
    public String getValidAccessToken(XeroConnection connection) {
        // Check if token is expired (with 5 minute buffer)
        LocalDateTime now = LocalDateTime.now();
        if (connection.getExpiresAt() != null && now.isBefore(connection.getExpiresAt().minusMinutes(5))) {
            // Token is still valid
            String decryptedToken = encryptionService.decrypt(connection.getAccessToken());
            log.debug("Using existing access token for tenant {}", connection.getTenantId());
            return decryptedToken;
        }
        
        // Token expired or will expire soon, refresh it
        log.info("Access token expired or expiring soon for tenant {}, refreshing...", connection.getTenantId());
        return refreshAccessToken(connection);
    }
    
    /**
     * Refresh the access token using the refresh token.
     * 
     * @param connection The Xero connection
     * @return New access token
     * @throws RuntimeException if refresh fails
     */
    private String refreshAccessToken(XeroConnection connection) {
        try {
            String refreshToken = encryptionService.decrypt(connection.getRefreshToken());
            
            // Build form data
            String formData = "grant_type=refresh_token" +
                "&refresh_token=" + URLEncoder.encode(refreshToken, StandardCharsets.UTF_8);
            
            // Create Basic Auth header
            String auth = clientId + ":" + clientSecret;
            String encodedAuth = Base64.getEncoder().encodeToString(auth.getBytes(StandardCharsets.UTF_8));
            
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(XERO_TOKEN_URL))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .header("Authorization", "Basic " + encodedAuth)
                .POST(HttpRequest.BodyPublishers.ofString(formData))
                .timeout(Duration.ofSeconds(30))
                .build();
            
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            
            if (response.statusCode() != 200) {
                log.error("Token refresh failed. Status: {}, Body: {}", response.statusCode(), response.body());
                throw new RuntimeException("Failed to refresh token: " + response.statusCode() + " - " + response.body());
            }
            
            JsonNode jsonResponse = objectMapper.readTree(response.body());
            String newAccessToken = jsonResponse.get("access_token").asText();
            String newRefreshToken = jsonResponse.has("refresh_token") 
                ? jsonResponse.get("refresh_token").asText() 
                : refreshToken; // Use old refresh token if new one not provided
            
            int expiresIn = jsonResponse.get("expires_in").asInt();
            LocalDateTime expiresAt = LocalDateTime.now().plusSeconds(expiresIn);
            
            // Update connection (note: we don't save to DB here, caller should handle that)
            connection.setAccessToken(encryptionService.encrypt(newAccessToken));
            connection.setRefreshToken(encryptionService.encrypt(newRefreshToken));
            connection.setExpiresAt(expiresAt);
            
            log.info("Successfully refreshed access token for tenant {}", connection.getTenantId());
            return newAccessToken;
            
        } catch (IOException | InterruptedException e) {
            log.error("Error refreshing access token for tenant {}", connection.getTenantId(), e);
            throw new RuntimeException("Failed to refresh token: " + e.getMessage(), e);
        }
    }
}

