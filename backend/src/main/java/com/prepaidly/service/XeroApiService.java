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
        
        // If not found, try to find it in the Journals endpoint
        log.info("JournalNumber not found in ManualJournals endpoint, trying Journals endpoint...");
        return fetchJournalNumberFromJournals(tenantId, journalId, accessToken);
    }
    
    /**
     * Try to fetch journal number from ManualJournals endpoint
     */
    private Integer fetchJournalNumberFromManualJournals(String tenantId, String journalId, String accessToken) {
        try {
            log.debug("Fetching manual journal details from Xero for journal ID: {}", journalId);
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(accessToken);
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("xero-tenant-id", tenantId);
            
            HttpEntity<Void> entity = new HttpEntity<>(headers);
            String url = XeroConfig.XERO_API_URL + "/ManualJournals/" + journalId;
            log.debug("GET ManualJournals request URL: {}", url);
            
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                entity,
                new ParameterizedTypeReference<Map<String, Object>>() {}
            );
            
            log.debug("GET ManualJournals response status: {}", response.getStatusCode());
            log.debug("GET ManualJournals response body: {}", response.getBody());
            
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> journals = (List<Map<String, Object>>) response.getBody().get("ManualJournals");
                if (journals != null && !journals.isEmpty()) {
                    Map<String, Object> journal = journals.get(0);
                    log.info("ManualJournals GET response journal keys: {}", journal.keySet());
                    log.info("ManualJournals GET response journal full: {}", journal);
                    
                    Object journalNumberObj = journal.get("JournalNumber");
                    if (journalNumberObj != null) {
                        if (journalNumberObj instanceof Integer) {
                            log.info("Fetched JournalNumber from ManualJournals GET request (Integer): {}", journalNumberObj);
                            return (Integer) journalNumberObj;
                        } else if (journalNumberObj instanceof String) {
                            try {
                                Integer num = Integer.parseInt((String) journalNumberObj);
                                log.info("Fetched JournalNumber from ManualJournals GET request (String parsed): {}", num);
                                return num;
                            } catch (NumberFormatException e) {
                                log.warn("Could not parse JournalNumber from ManualJournals GET request: {}", journalNumberObj);
                            }
                        } else {
                            log.warn("JournalNumber is unexpected type: {} (value: {})", journalNumberObj.getClass().getName(), journalNumberObj);
                        }
                    } else {
                        log.info("JournalNumber field not found in ManualJournals GET response. Available fields: {}", journal.keySet());
                    }
                } else {
                    log.warn("No ManualJournals in GET response. Response keys: {}", response.getBody().keySet());
                }
            } else {
                log.warn("ManualJournals GET request failed or returned empty body. Status: {}, Body: {}", response.getStatusCode(), response.getBody());
            }
        } catch (org.springframework.web.client.HttpClientErrorException e) {
            log.warn("HTTP error fetching from ManualJournals endpoint for journal ID {}. Status: {}, Response: {}", 
                journalId, e.getStatusCode(), e.getResponseBodyAsString());
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
            log.debug("Fetching journal number from Journals endpoint for manual journal ID: {}", journalId);
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(accessToken);
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("xero-tenant-id", tenantId);
            
            HttpEntity<Void> entity = new HttpEntity<>(headers);
            // Query recent journals - we'll search through them to find one matching our ManualJournalID
            // Get the last 100 journals (Xero's default page size)
            String url = XeroConfig.XERO_API_URL + "/Journals";
            log.debug("GET Journals request URL: {}", url);
            
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                entity,
                new ParameterizedTypeReference<Map<String, Object>>() {}
            );
            
            log.debug("GET Journals response status: {}", response.getStatusCode());
            
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> journals = (List<Map<String, Object>>) response.getBody().get("Journals");
                if (journals != null && !journals.isEmpty()) {
                    log.info("Found {} journals in response, searching for ManualJournalID: {}", journals.size(), journalId);
                    
                    // Search for a journal that references our ManualJournalID
                    for (Map<String, Object> journal : journals) {
                        // Check if this journal has a reference to our manual journal
                        // The journal might have a SourceID or similar field pointing to the ManualJournalID
                        Object sourceId = journal.get("SourceID");
                        Object journalIdField = journal.get("JournalID");
                        Object manualJournalId = journal.get("ManualJournalID");
                        
                        // Check various possible fields that might link to our manual journal
                        if (journalId.equals(String.valueOf(sourceId)) || 
                            journalId.equals(String.valueOf(journalIdField)) ||
                            journalId.equals(String.valueOf(manualJournalId))) {
                            
                            Object journalNumberObj = journal.get("JournalNumber");
                            if (journalNumberObj != null) {
                                if (journalNumberObj instanceof Integer) {
                                    log.info("Found JournalNumber in Journals endpoint (Integer): {}", journalNumberObj);
                                    return (Integer) journalNumberObj;
                                } else if (journalNumberObj instanceof String) {
                                    try {
                                        Integer num = Integer.parseInt((String) journalNumberObj);
                                        log.info("Found JournalNumber in Journals endpoint (String parsed): {}", num);
                                        return num;
                                    } catch (NumberFormatException e) {
                                        log.warn("Could not parse JournalNumber from Journals endpoint: {}", journalNumberObj);
                                    }
                                }
                            }
                        }
                    }
                    
                    log.info("Could not find journal matching ManualJournalID {} in Journals response. Searched {} journals.", journalId, journals.size());
                    if (!journals.isEmpty()) {
                        log.debug("Sample journal keys from first journal: {}", journals.get(0).keySet());
                    }
                } else {
                    log.warn("No Journals in GET response. Response keys: {}", response.getBody().keySet());
                }
            } else {
                log.warn("Journals GET request failed or returned empty body. Status: {}, Body: {}", response.getStatusCode(), response.getBody());
            }
        } catch (org.springframework.web.client.HttpClientErrorException e) {
            log.warn("HTTP error fetching from Journals endpoint for journal ID {}. Status: {}, Response: {}", 
                journalId, e.getStatusCode(), e.getResponseBodyAsString());
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
                        
                        // Log all available keys in the journal response for debugging
                        log.info("ManualJournal response keys: {}", journal.keySet());
                        log.info("ManualJournal full response: {}", journal);
                        
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
                            log.info("Extracted JournalNumber from POST response: {}", journalNumber);
                        }
                        
                        // Always fetch the journal via GET to ensure we get the JournalNumber
                        // (Xero API may not return JournalNumber in POST response, but it's always available via GET)
                        if (journalNumber == null) {
                            log.info("JournalNumber not found in POST response, fetching via GET request for journal ID: {}", journalId);
                        } else {
                            log.info("JournalNumber found in POST response, but verifying via GET request for journal ID: {}", journalId);
                        }
                        
                        // Fetch via GET to get the journal number (this should always work since we have the journal ID)
                        Integer fetchedNumber = fetchJournalNumber(tenantId, journalId, accessToken);
                        if (fetchedNumber != null) {
                            journalNumber = fetchedNumber;
                            log.info("Successfully fetched JournalNumber via GET: {}", journalNumber);
                        } else {
                            if (journalNumber == null) {
                                log.warn("Could not fetch JournalNumber via GET request for journal ID: {}. Response may not include JournalNumber field.", journalId);
                            } else {
                                log.info("Using JournalNumber from POST response: {}", journalNumber);
                            }
                        }
                        
                        log.info("Successfully created manual journal in Xero with ID: {}, JournalNumber: {}", journalId, journalNumber);
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

