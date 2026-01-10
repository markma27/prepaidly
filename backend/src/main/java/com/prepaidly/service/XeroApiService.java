package com.prepaidly.service;

import com.prepaidly.config.XeroConfig;
import com.prepaidly.dto.XeroAccountResponse;
import com.prepaidly.dto.XeroInvoiceResponse;
import com.prepaidly.model.XeroConnection;
import com.prepaidly.repository.XeroConnectionRepository;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.util.*;
import java.util.Objects;

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
        // Fetch connection first, before any token operations
        XeroConnection connection = xeroConnectionRepository.findByTenantId(tenantId)
            .orElseThrow(() -> new RuntimeException("Xero connection not found for tenant: " + tenantId));
        
        try {
            // Get access token - this may trigger refresh in a separate transaction
            String accessToken;
            try {
                accessToken = xeroOAuthService.getValidAccessToken(connection);
                if (accessToken == null) {
                    throw new RuntimeException("Failed to get valid access token. Please refresh your Xero connection.");
                }
            } catch (Exception tokenError) {
                log.error("Token refresh/validation failed for tenant {}", tenantId, tokenError);
                throw new RuntimeException("Failed to get valid access token. The refresh token may have expired. Please reconnect to Xero.", tokenError);
            }
            
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(accessToken);
            headers.setAccept(Objects.requireNonNull(Collections.singletonList(MediaType.APPLICATION_JSON)));
            headers.set("xero-tenant-id", Objects.requireNonNull(tenantId, "Tenant ID cannot be null"));
            
            HttpEntity<String> entity = new HttpEntity<>(headers);
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                XeroConfig.XERO_API_URL + "/Accounts",
                Objects.requireNonNull(HttpMethod.GET),
                entity,
                new ParameterizedTypeReference<Map<String, Object>>() {}
            );
            
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                Map<String, Object> body = Objects.requireNonNull(response.getBody());
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
        } catch (org.springframework.web.client.HttpClientErrorException e) {
            log.error("HTTP error fetching accounts for tenant {}. Status: {}, Response: {}", 
                tenantId, e.getStatusCode(), e.getResponseBodyAsString(), e);
            String errorMsg = "Failed to fetch accounts from Xero";
            if (e.getStatusCode().value() == 401) {
                errorMsg = "Xero authentication failed. Please refresh your connection.";
            } else if (e.getStatusCode().value() == 403) {
                errorMsg = "Access denied. Please check your Xero connection permissions.";
            }
            throw new RuntimeException(errorMsg + ": " + e.getResponseBodyAsString(), e);
        } catch (org.springframework.web.client.ResourceAccessException e) {
            log.error("Network error fetching accounts for tenant {}", tenantId, e);
            throw new RuntimeException("Network error connecting to Xero API. Please check your internet connection.", e);
        } catch (RuntimeException e) {
            // Re-throw RuntimeException as-is to preserve error message
            throw e;
        } catch (Exception e) {
            log.error("Error fetching accounts for tenant {}", tenantId, e);
            throw new RuntimeException("Failed to fetch accounts: " + e.getMessage(), e);
        }
    }
    
    /**
     * Get invoices/bills for a tenant
     */
    public XeroInvoiceResponse getInvoices(String tenantId) {
        try {
            XeroConnection connection = xeroConnectionRepository.findByTenantId(tenantId)
                .orElseThrow(() -> new RuntimeException("Xero connection not found for tenant: " + tenantId));
            
            String accessToken = Objects.requireNonNull(xeroOAuthService.getValidAccessToken(connection), "Access token cannot be null");
            
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(accessToken);
            headers.setAccept(Objects.requireNonNull(Collections.singletonList(MediaType.APPLICATION_JSON)));
            headers.set("xero-tenant-id", Objects.requireNonNull(tenantId, "Tenant ID cannot be null"));
            
            HttpEntity<String> entity = new HttpEntity<>(headers);
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                XeroConfig.XERO_API_URL + "/Invoices",
                Objects.requireNonNull(HttpMethod.GET),
                entity,
                new ParameterizedTypeReference<Map<String, Object>>() {}
            );
            
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                Map<String, Object> body = Objects.requireNonNull(response.getBody());
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
     * Result class for manual journal creation
     */
    @Data
    @AllArgsConstructor
    public static class ManualJournalResult {
        private String journalId;
        private Integer journalNumber;
    }
    
    /**
     * Fetch journal number from Xero by retrieving the journal after creation.
     * First tries ManualJournals endpoint, then falls back to Journals endpoint.
     */
    private Integer fetchJournalNumber(String tenantId, String journalId, String accessToken) {
        // First, try to get JournalNumber from ManualJournals endpoint
        Integer journalNumber = fetchJournalNumberFromManualJournals(tenantId, journalId, accessToken);
        if (journalNumber != null) {
            return journalNumber;
        }
        
        // If not found, wait a moment for Xero to process, then try Journals endpoint
        try {
            Thread.sleep(2000); // Wait 2 seconds for Xero to process the journal
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        return fetchJournalNumberFromJournals(tenantId, journalId, accessToken);
    }
    
    /**
     * Try to fetch journal number from ManualJournals endpoint
     */
    private Integer fetchJournalNumberFromManualJournals(String tenantId, String journalId, String accessToken) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(accessToken);
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("xero-tenant-id", tenantId);
            
            HttpEntity<Void> entity = new HttpEntity<>(headers);
            String url = XeroConfig.XERO_API_URL + "/ManualJournals/" + journalId;
            
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                entity,
                new ParameterizedTypeReference<Map<String, Object>>() {}
            );
            
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> journals = (List<Map<String, Object>>) response.getBody().get("ManualJournals");
                if (journals != null && !journals.isEmpty()) {
                    Map<String, Object> journal = journals.get(0);
                    Object journalNumberObj = journal.get("JournalNumber");
                    if (journalNumberObj != null) {
                        if (journalNumberObj instanceof Integer) {
                            return (Integer) journalNumberObj;
                        } else if (journalNumberObj instanceof String) {
                            try {
                                return Integer.parseInt((String) journalNumberObj);
                            } catch (NumberFormatException e) {
                                log.warn("Could not parse JournalNumber from ManualJournals GET request: {}", journalNumberObj);
                            }
                        }
                    }
                }
            }
        } catch (org.springframework.web.client.HttpClientErrorException e) {
            log.warn("HTTP error fetching from ManualJournals endpoint for journal ID {}. Status: {}", 
                journalId, e.getStatusCode());
        } catch (Exception e) {
            log.warn("Failed to fetch from ManualJournals endpoint for journal ID {}: {}", journalId, e.getMessage());
        }
        return null;
    }
    
    /**
     * Try to fetch journal number from Journals endpoint by searching for the manual journal
     */
    private Integer fetchJournalNumberFromJournals(String tenantId, String journalId, String accessToken) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(accessToken);
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("xero-tenant-id", tenantId);
            
            HttpEntity<Void> entity = new HttpEntity<>(headers);
            String url = XeroConfig.XERO_API_URL + "/Journals";
            
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                entity,
                new ParameterizedTypeReference<Map<String, Object>>() {}
            );
            
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> journals = (List<Map<String, Object>>) response.getBody().get("Journals");
                if (journals != null && !journals.isEmpty()) {
                    // Search for a journal that references our ManualJournalID
                    for (Map<String, Object> journal : journals) {
                        Object sourceId = journal.get("SourceID");
                        Object journalIdField = journal.get("JournalID");
                        Object manualJournalId = journal.get("ManualJournalID");
                        Object sourceType = journal.get("SourceType");
                        
                        // Check various possible fields that might link to our manual journal
                        boolean matches = false;
                        if (journalId.equals(String.valueOf(sourceId)) || 
                            journalId.equals(String.valueOf(journalIdField)) ||
                            journalId.equals(String.valueOf(manualJournalId))) {
                            matches = true;
                        } else if (("MANUALJOURNAL".equalsIgnoreCase(String.valueOf(sourceType)) || 
                                   "ManualJournal".equalsIgnoreCase(String.valueOf(sourceType))) &&
                                   journal.get("JournalNumber") != null) {
                            matches = true;
                        }
                        
                        if (matches) {
                            Object journalNumberObj = journal.get("JournalNumber");
                            if (journalNumberObj != null) {
                                if (journalNumberObj instanceof Integer) {
                                    return (Integer) journalNumberObj;
                                } else if (journalNumberObj instanceof String) {
                                    try {
                                        return Integer.parseInt((String) journalNumberObj);
                                    } catch (NumberFormatException e) {
                                        log.warn("Could not parse JournalNumber from Journals endpoint: {}", journalNumberObj);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch (org.springframework.web.client.HttpClientErrorException e) {
            log.warn("HTTP error fetching from Journals endpoint for journal ID {}. Status: {}", 
                journalId, e.getStatusCode());
        } catch (Exception e) {
            log.warn("Failed to fetch from Journals endpoint for journal ID {}: {}", journalId, e.getMessage());
        }
        return null;
    }
    
    /**
     * Create a manual journal in Xero
     */
    public ManualJournalResult createManualJournal(String tenantId, String narration, LocalDate journalDate,
                                     List<JournalLine> journalLines) {
        try {
            XeroConnection connection = xeroConnectionRepository.findByTenantId(tenantId)
                .orElseThrow(() -> new RuntimeException("Xero connection not found for tenant: " + tenantId));
            
            String accessToken = Objects.requireNonNull(xeroOAuthService.getValidAccessToken(connection), "Access token cannot be null");
            
            // Build journal request
            Map<String, Object> journalRequest = new HashMap<>();
            Map<String, Object> manualJournal = new HashMap<>();
            manualJournal.put("Narration", narration);
            // Xero API expects "Date" not "JournalDate", and format should be YYYY-MM-DD
            manualJournal.put("Date", journalDate.toString());
            // Set status to POSTED so it appears in Xero immediately
            manualJournal.put("Status", "POSTED");
            
            List<Map<String, Object>> journalLinesList = new ArrayList<>();
            for (JournalLine line : journalLines) {
                Map<String, Object> lineMap = new HashMap<>();
                lineMap.put("AccountCode", line.getAccountCode());
                lineMap.put("Description", line.getDescription());
                // Xero API expects LineAmount as number (not BigDecimal), and positive = debit, negative = credit
                lineMap.put("LineAmount", line.getLineAmount().doubleValue());
                // Add TaxType to avoid tax calculation issues
                lineMap.put("TaxType", "NONE");
                journalLinesList.add(lineMap);
            }
            manualJournal.put("JournalLines", journalLinesList);
            
            journalRequest.put("ManualJournals", Collections.singletonList(manualJournal));
            
            log.info("Creating manual journal in Xero for tenant {}: {}", tenantId, journalRequest);
            
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(accessToken);
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setAccept(Objects.requireNonNull(Collections.singletonList(MediaType.APPLICATION_JSON)));
            headers.set("xero-tenant-id", Objects.requireNonNull(tenantId, "Tenant ID cannot be null"));
            
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(journalRequest, headers);
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                XeroConfig.XERO_API_URL + "/ManualJournals",
                Objects.requireNonNull(HttpMethod.POST),
                entity,
                new ParameterizedTypeReference<Map<String, Object>>() {}
            );
            
            log.info("Xero API response status: {}", response.getStatusCode());
            log.info("Xero API response body: {}", response.getBody());
            
            if (response.getStatusCode() == HttpStatus.OK || response.getStatusCode() == HttpStatus.CREATED) {
                Map<String, Object> body = response.getBody();
                if (body != null) {
                    // Check for validation errors
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> validationErrors = (List<Map<String, Object>>) body.get("ValidationErrors");
                    if (validationErrors != null && !validationErrors.isEmpty()) {
                        String errorMessage = validationErrors.stream()
                            .map(err -> err.get("Message") != null ? err.get("Message").toString() : "Validation error")
                            .reduce((a, b) -> a + "; " + b)
                            .orElse("Validation error");
                        log.error("Xero validation errors: {}", validationErrors);
                        throw new RuntimeException("Xero validation error: " + errorMessage);
                    }
                    
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> journals = (List<Map<String, Object>>) body.get("ManualJournals");
                    if (journals != null && !journals.isEmpty()) {
                        Map<String, Object> journal = journals.get(0);
                        String journalId = (String) journal.get("ManualJournalID");
                        Integer journalNumber = null;
                        
                        // Extract JournalNumber if available in POST response (Xero API may return it as Integer or String)
                        Object journalNumberObj = journal.get("JournalNumber");
                        if (journalNumberObj != null) {
                            if (journalNumberObj instanceof Integer) {
                                journalNumber = (Integer) journalNumberObj;
                            } else if (journalNumberObj instanceof String) {
                                try {
                                    journalNumber = Integer.parseInt((String) journalNumberObj);
                                } catch (NumberFormatException e) {
                                    log.warn("Could not parse JournalNumber as integer: {}", journalNumberObj);
                                }
                            }
                        }
                        
                        // Always fetch the journal via GET to ensure we get the JournalNumber
                        // (Xero API may not return JournalNumber in POST response, but it's always available via GET)
                        Integer fetchedNumber = fetchJournalNumber(tenantId, journalId, accessToken);
                        if (fetchedNumber != null) {
                            journalNumber = fetchedNumber;
                        }
                        
                        log.info("Created manual journal in Xero. ID: {}, JournalNumber: {}", journalId, journalNumber);
                        return new ManualJournalResult(journalId, journalNumber);
                    } else {
                        log.error("No ManualJournals in response. Response keys: {}", body.keySet());
                        throw new RuntimeException("No manual journal returned from Xero API");
                    }
                }
            }
            
            Map<String, Object> responseBody = response.getBody();
            String errorBody = responseBody != null ? responseBody.toString() : "No response body";
            log.error("Failed to create manual journal. Status: {}, Body: {}", response.getStatusCode(), errorBody);
            throw new RuntimeException("Failed to create manual journal: " + response.getStatusCode() + ". Response: " + errorBody);
        } catch (org.springframework.web.client.HttpClientErrorException e) {
            log.error("HTTP error creating manual journal for tenant {}. Status: {}, Response: {}", 
                tenantId, e.getStatusCode(), e.getResponseBodyAsString(), e);
            throw new RuntimeException("Failed to create manual journal: " + e.getStatusCode() + ". " + e.getResponseBodyAsString(), e);
        } catch (Exception e) {
            log.error("Error creating manual journal for tenant {}", tenantId, e);
            throw new RuntimeException("Failed to create manual journal: " + e.getMessage(), e);
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

