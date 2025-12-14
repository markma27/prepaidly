package com.prepaidly.controller;

import com.prepaidly.config.XeroConfig;
import com.prepaidly.dto.XeroConnectionResponse;
import com.prepaidly.dto.XeroConnectionStatusResponse;
import com.prepaidly.model.User;
import com.prepaidly.model.XeroConnection;
import com.prepaidly.repository.UserRepository;
import com.prepaidly.repository.XeroConnectionRepository;
import com.prepaidly.service.XeroOAuthService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/auth/xero")
@RequiredArgsConstructor
public class XeroAuthController {

    private final XeroOAuthService xeroOAuthService;
    private final XeroConnectionRepository xeroConnectionRepository;
    private final UserRepository userRepository;
    private final XeroConfig xeroConfig;
    
    // Temporary: For development, we'll use a default user ID
    // In production, this should come from authenticated session
    private static final Long DEFAULT_USER_ID = 1L;

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

    @GetMapping("/callback")
    public ResponseEntity<?> callback(
            @RequestParam String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) Long userId) {
        try {
            Long targetUserId = userId != null ? userId : DEFAULT_USER_ID;
            XeroConnection connection = xeroOAuthService.exchangeCodeForTokens(code, targetUserId);
            
            // Redirect to frontend success page
            return ResponseEntity.status(HttpStatus.FOUND)
                .header("Location", "http://localhost:3000/app/connected?success=true&tenantId=" + connection.getTenantId())
                .body(Map.of(
                    "success", true,
                    "tenantId", connection.getTenantId(),
                    "message", "Successfully connected to Xero"
                ));
        } catch (Exception e) {
            log.error("Error handling OAuth callback", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .header("Location", "http://localhost:3000/app/connected?success=false&error=" + e.getMessage())
                .body(Map.of(
                    "success", false,
                    "error", "Failed to complete OAuth flow: " + e.getMessage()
                ));
        }
    }

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
        return ResponseEntity.ok(config);
    }

    @GetMapping("/status")
    public ResponseEntity<XeroConnectionStatusResponse> status(@RequestParam(required = false) Long userId) {
        try {
            // Debug: Log all users and connections
            List<User> allUsers = userRepository.findAll();
            log.info("Total users in database: {}", allUsers.size());
            for (User u : allUsers) {
                log.info("User: ID={}, Email={}", u.getId(), u.getEmail());
                List<XeroConnection> userConnections = xeroConnectionRepository.findByUserId(u.getId());
                log.info("  Connections for user {}: {}", u.getId(), userConnections.size());
                for (XeroConnection conn : userConnections) {
                    log.info("    Connection: ID={}, TenantID={}", conn.getId(), conn.getTenantId());
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
                        String accessToken = xeroOAuthService.getValidAccessToken(conn);
                        // Pass tenantId to getTenantInfo to ensure correct tenant is queried
                        Map<String, Object> tenantInfo = xeroOAuthService.getTenantInfo(accessToken, conn.getTenantId());
                        
                        XeroConnectionResponse response = new XeroConnectionResponse();
                        response.setTenantId(conn.getTenantId());
                        response.setConnected(true);
                        if (tenantInfo != null) {
                            response.setTenantName((String) tenantInfo.get("Name"));
                        } else {
                            response.setTenantName("Unknown");
                        }
                        response.setMessage("Connected");
                        return response;
                    } catch (Exception e) {
                        log.error("Error getting tenant info for connection {}", conn.getId(), e);
                        XeroConnectionResponse response = new XeroConnectionResponse();
                        response.setTenantId(conn.getTenantId());
                        response.setConnected(false);
                        response.setTenantName("Unknown");
                        response.setMessage("Error: " + e.getMessage());
                        return response;
                    }
                })
                .collect(Collectors.toList());
            
            XeroConnectionStatusResponse statusResponse = new XeroConnectionStatusResponse();
            statusResponse.setConnections(connectionResponses);
            statusResponse.setTotalConnections(connectionResponses.size());
            
            return ResponseEntity.ok(statusResponse);
        } catch (Exception e) {
            log.error("Error getting connection status", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

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

