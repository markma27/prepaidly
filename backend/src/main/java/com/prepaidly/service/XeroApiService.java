package com.prepaidly.service;

import com.prepaidly.config.XeroConfig;
import com.prepaidly.dto.XeroAccountResponse;
import com.prepaidly.dto.XeroInvoiceResponse;
import com.prepaidly.model.XeroConnection;
import com.prepaidly.repository.XeroConnectionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class XeroApiService {
    
    private final XeroOAuthService xeroOAuthService;
    private final XeroConnectionRepository xeroConnectionRepository;
    private final RestTemplate restTemplate;
    
    /**
     * Get accounts for a tenant
     */
    public XeroAccountResponse getAccounts(String tenantId) {
        try {
            XeroConnection connection = xeroConnectionRepository.findByTenantId(tenantId)
                .orElseThrow(() -> new RuntimeException("Xero connection not found for tenant: " + tenantId));
            
            String accessToken = xeroOAuthService.getValidAccessToken(connection);
            
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(accessToken);
            headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
            headers.set("xero-tenant-id", tenantId);
            
            HttpEntity<String> entity = new HttpEntity<>(headers);
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                XeroConfig.XERO_API_URL + "/Accounts",
                HttpMethod.GET,
                entity,
                new ParameterizedTypeReference<Map<String, Object>>() {}
            );
            
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                Map<String, Object> body = response.getBody();
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> accountsList = (List<Map<String, Object>>) body.get("Accounts");
                
                XeroAccountResponse accountResponse = new XeroAccountResponse();
                List<XeroAccountResponse.Account> accounts = new ArrayList<>();
                
                if (accountsList != null) {
                    for (Map<String, Object> accountMap : accountsList) {
                        XeroAccountResponse.Account account = new XeroAccountResponse.Account();
                        account.setAccountID((String) accountMap.get("AccountID"));
                        account.setCode((String) accountMap.get("Code"));
                        account.setName((String) accountMap.get("Name"));
                        account.setType((String) accountMap.get("Type"));
                        account.setStatus((String) accountMap.get("Status"));
                        if (accountMap.get("IsSystemAccount") != null) {
                            account.setIsSystemAccount((Boolean) accountMap.get("IsSystemAccount"));
                        }
                        accounts.add(account);
                    }
                }
                
                accountResponse.setAccounts(accounts);
                return accountResponse;
            }
            
            throw new RuntimeException("Failed to fetch accounts: " + response.getStatusCode());
        } catch (Exception e) {
            log.error("Error fetching accounts for tenant {}", tenantId, e);
            throw new RuntimeException("Failed to fetch accounts", e);
        }
    }
    
    /**
     * Get invoices/bills for a tenant
     */
    public XeroInvoiceResponse getInvoices(String tenantId) {
        try {
            XeroConnection connection = xeroConnectionRepository.findByTenantId(tenantId)
                .orElseThrow(() -> new RuntimeException("Xero connection not found for tenant: " + tenantId));
            
            String accessToken = xeroOAuthService.getValidAccessToken(connection);
            
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(accessToken);
            headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
            headers.set("xero-tenant-id", tenantId);
            
            HttpEntity<String> entity = new HttpEntity<>(headers);
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                XeroConfig.XERO_API_URL + "/Invoices",
                HttpMethod.GET,
                entity,
                new ParameterizedTypeReference<Map<String, Object>>() {}
            );
            
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                Map<String, Object> body = response.getBody();
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> invoicesList = (List<Map<String, Object>>) body.get("Invoices");
                
                XeroInvoiceResponse invoiceResponse = new XeroInvoiceResponse();
                List<XeroInvoiceResponse.Invoice> invoices = new ArrayList<>();
                
                if (invoicesList != null) {
                    for (Map<String, Object> invoiceMap : invoicesList) {
                        XeroInvoiceResponse.Invoice invoice = new XeroInvoiceResponse.Invoice();
                        invoice.setInvoiceID((String) invoiceMap.get("InvoiceID"));
                        invoice.setInvoiceNumber((String) invoiceMap.get("InvoiceNumber"));
                        invoice.setType((String) invoiceMap.get("Type"));
                        
                        // Parse dates
                        if (invoiceMap.get("Date") != null) {
                            invoice.setDate(parseDate((String) invoiceMap.get("Date")));
                        }
                        if (invoiceMap.get("DueDate") != null) {
                            invoice.setDueDate(parseDate((String) invoiceMap.get("DueDate")));
                        }
                        
                        // Parse amounts
                        if (invoiceMap.get("Total") != null) {
                            invoice.setTotal(parseDecimal(invoiceMap.get("Total")));
                        }
                        if (invoiceMap.get("TotalTax") != null) {
                            invoice.setTotalTax(parseDecimal(invoiceMap.get("TotalTax")));
                        }
                        if (invoiceMap.get("AmountDue") != null) {
                            invoice.setAmountDue(parseDecimal(invoiceMap.get("AmountDue")));
                        }
                        
                        invoice.setStatus((String) invoiceMap.get("Status"));
                        
                        // Parse contact
                        @SuppressWarnings("unchecked")
                        Map<String, Object> contact = (Map<String, Object>) invoiceMap.get("Contact");
                        if (contact != null) {
                            invoice.setContactID((String) contact.get("ContactID"));
                            invoice.setContactName((String) contact.get("Name"));
                        }
                        
                        invoices.add(invoice);
                    }
                }
                
                invoiceResponse.setInvoices(invoices);
                return invoiceResponse;
            }
            
            throw new RuntimeException("Failed to fetch invoices: " + response.getStatusCode());
        } catch (Exception e) {
            log.error("Error fetching invoices for tenant {}", tenantId, e);
            throw new RuntimeException("Failed to fetch invoices", e);
        }
    }
    
    /**
     * Create a manual journal in Xero
     */
    public String createManualJournal(String tenantId, String narration, LocalDate journalDate,
                                     List<JournalLine> journalLines) {
        try {
            XeroConnection connection = xeroConnectionRepository.findByTenantId(tenantId)
                .orElseThrow(() -> new RuntimeException("Xero connection not found for tenant: " + tenantId));
            
            String accessToken = xeroOAuthService.getValidAccessToken(connection);
            
            // Build journal request
            Map<String, Object> journalRequest = new HashMap<>();
            Map<String, Object> manualJournal = new HashMap<>();
            manualJournal.put("Narration", narration);
            manualJournal.put("JournalDate", journalDate.toString());
            
            List<Map<String, Object>> journalLinesList = new ArrayList<>();
            for (JournalLine line : journalLines) {
                Map<String, Object> lineMap = new HashMap<>();
                lineMap.put("AccountCode", line.getAccountCode());
                lineMap.put("Description", line.getDescription());
                lineMap.put("LineAmount", line.getLineAmount());
                journalLinesList.add(lineMap);
            }
            manualJournal.put("JournalLines", journalLinesList);
            
            journalRequest.put("ManualJournals", Collections.singletonList(manualJournal));
            
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(accessToken);
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
            headers.set("xero-tenant-id", tenantId);
            
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(journalRequest, headers);
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                XeroConfig.XERO_API_URL + "/ManualJournals",
                HttpMethod.POST,
                entity,
                new ParameterizedTypeReference<Map<String, Object>>() {}
            );
            
            if (response.getStatusCode() == HttpStatus.OK || response.getStatusCode() == HttpStatus.CREATED) {
                if (response.getBody() != null) {
                    Map<String, Object> body = response.getBody();
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> journals = (List<Map<String, Object>>) body.get("ManualJournals");
                    if (journals != null && !journals.isEmpty()) {
                        return (String) journals.get(0).get("ManualJournalID");
                    }
                }
            }
            
            throw new RuntimeException("Failed to create manual journal: " + response.getStatusCode());
        } catch (Exception e) {
            log.error("Error creating manual journal for tenant {}", tenantId, e);
            throw new RuntimeException("Failed to create manual journal", e);
        }
    }
    
    private java.time.LocalDate parseDate(String dateStr) {
        if (dateStr == null || dateStr.isEmpty()) {
            return null;
        }
        try {
            // Xero API returns dates in format: /Date(1234567890000+0000)/
            if (dateStr.startsWith("/Date(")) {
                String timestampStr = dateStr.substring(6, dateStr.indexOf("+"));
                long timestamp = Long.parseLong(timestampStr);
                return java.time.Instant.ofEpochMilli(timestamp)
                    .atZone(java.time.ZoneId.of("UTC"))
                    .toLocalDate();
            }
            // Try standard ISO format
            return java.time.LocalDate.parse(dateStr);
        } catch (Exception e) {
            log.warn("Failed to parse date: {}", dateStr, e);
            return null;
        }
    }
    
    private java.math.BigDecimal parseDecimal(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number) {
            return java.math.BigDecimal.valueOf(((Number) value).doubleValue());
        }
        try {
            return new java.math.BigDecimal(value.toString());
        } catch (Exception e) {
            log.warn("Failed to parse decimal: {}", value, e);
            return null;
        }
    }
    
    /**
     * Journal line for manual journal creation
     */
    @lombok.Data
    public static class JournalLine {
        private String accountCode;
        private String description;
        private java.math.BigDecimal lineAmount;
    }
}

