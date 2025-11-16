package com.prepaidly.controller;

import com.prepaidly.dto.XeroAccountResponse;
import com.prepaidly.dto.XeroInvoiceResponse;
import com.prepaidly.service.XeroApiService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/xero")
@RequiredArgsConstructor
public class XeroController {

    private final XeroApiService xeroApiService;

    @GetMapping("/accounts")
    public ResponseEntity<?> getAccounts(@RequestParam String tenantId) {
        try {
            XeroAccountResponse accounts = xeroApiService.getAccounts(tenantId);
            return ResponseEntity.ok(accounts);
        } catch (Exception e) {
            log.error("Error fetching accounts for tenant {}", tenantId, e);
            return ResponseEntity.status(500).body(Map.of(
                "error", "Failed to fetch accounts: " + e.getMessage()
            ));
        }
    }

    @GetMapping("/invoices")
    public ResponseEntity<?> getInvoices(@RequestParam String tenantId) {
        try {
            XeroInvoiceResponse invoices = xeroApiService.getInvoices(tenantId);
            return ResponseEntity.ok(invoices);
        } catch (Exception e) {
            log.error("Error fetching invoices for tenant {}", tenantId, e);
            return ResponseEntity.status(500).body(Map.of(
                "error", "Failed to fetch invoices: " + e.getMessage()
            ));
        }
    }
}
