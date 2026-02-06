package com.prepaidly.controller;

import com.prepaidly.model.TenantSettings;
import com.prepaidly.repository.TenantSettingsRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/settings")
@RequiredArgsConstructor
public class TenantSettingsController {

    private final TenantSettingsRepository tenantSettingsRepository;

    /**
     * Get tenant settings (default accounts)
     */
    @GetMapping
    public ResponseEntity<?> getSettings(@RequestParam String tenantId) {
        try {
            TenantSettings settings = tenantSettingsRepository.findByTenantId(tenantId)
                .orElse(null);

            if (settings == null) {
                return ResponseEntity.ok(Map.of(
                    "prepaymentAccount", "",
                    "unearnedAccount", ""
                ));
            }

            return ResponseEntity.ok(Map.of(
                "prepaymentAccount", settings.getDefaultPrepaymentAcctCode() != null ? settings.getDefaultPrepaymentAcctCode() : "",
                "unearnedAccount", settings.getDefaultUnearnedAcctCode() != null ? settings.getDefaultUnearnedAcctCode() : ""
            ));
        } catch (Exception e) {
            log.error("Error fetching settings for tenant {}", tenantId, e);
            return ResponseEntity.status(500).body(Map.of(
                "error", "Failed to fetch settings: " + e.getMessage()
            ));
        }
    }

    /**
     * Save tenant settings (default accounts)
     */
    @PutMapping
    public ResponseEntity<?> saveSettings(@RequestParam String tenantId, @RequestBody Map<String, String> request) {
        try {
            TenantSettings settings = tenantSettingsRepository.findByTenantId(tenantId)
                .orElseGet(() -> {
                    TenantSettings s = new TenantSettings();
                    s.setTenantId(tenantId);
                    return s;
                });

            settings.setDefaultPrepaymentAcctCode(request.getOrDefault("prepaymentAccount", ""));
            settings.setDefaultUnearnedAcctCode(request.getOrDefault("unearnedAccount", ""));

            tenantSettingsRepository.save(settings);

            return ResponseEntity.ok(Map.of(
                "prepaymentAccount", settings.getDefaultPrepaymentAcctCode() != null ? settings.getDefaultPrepaymentAcctCode() : "",
                "unearnedAccount", settings.getDefaultUnearnedAcctCode() != null ? settings.getDefaultUnearnedAcctCode() : ""
            ));
        } catch (Exception e) {
            log.error("Error saving settings for tenant {}", tenantId, e);
            return ResponseEntity.status(500).body(Map.of(
                "error", "Failed to save settings: " + e.getMessage()
            ));
        }
    }
}
