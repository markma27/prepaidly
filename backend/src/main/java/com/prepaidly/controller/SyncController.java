package com.prepaidly.controller;

import com.prepaidly.model.XeroConnection;
import com.prepaidly.repository.XeroConnectionRepository;
import com.prepaidly.service.XeroOAuthService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/sync")
@RequiredArgsConstructor
public class SyncController {

    private final XeroOAuthService xeroOAuthService;
    private final XeroConnectionRepository xeroConnectionRepository;

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

