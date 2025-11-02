package com.prepaidly.controller;

import com.prepaidly.dto.XeroConnectionResponse;
import com.prepaidly.dto.XeroConnectionStatusResponse;
import com.prepaidly.model.XeroConnection;
import com.prepaidly.repository.XeroConnectionRepository;
import com.prepaidly.service.XeroOAuthService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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
    
    // Temporary: For development, we'll use a default user ID
    // In production, this should come from authenticated session
    private static final Long DEFAULT_USER_ID = 1L;

    @GetMapping("/connect")
    public ResponseEntity<?> connect(@RequestParam(required = false) Long userId) {
        try {
            Long targetUserId = userId != null ? userId : DEFAULT_USER_ID;
            String authUrl = xeroOAuthService.getAuthorizationUrl(targetUserId);
            
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

    @GetMapping("/status")
    public ResponseEntity<XeroConnectionStatusResponse> status(@RequestParam(required = false) Long userId) {
        try {
            Long targetUserId = userId != null ? userId : DEFAULT_USER_ID;
            List<XeroConnection> connections = xeroConnectionRepository.findByUserId(targetUserId);
            
            List<XeroConnectionResponse> connectionResponses = connections.stream()
                .map(conn -> {
                    try {
                        String accessToken = xeroOAuthService.getValidAccessToken(conn);
                        Map<String, Object> tenantInfo = xeroOAuthService.getTenantInfo(accessToken);
                        
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
}

