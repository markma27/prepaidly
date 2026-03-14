package com.prepaidly.service;

import com.prepaidly.config.XeroConfig;
import com.prepaidly.dto.XeroAccountResponse;
import com.prepaidly.dto.XeroBalanceSheetResponse;
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
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.util.*;
import java.math.BigDecimal;

/**
 * Xero API Service
 * 
 * All Xero API calls go through this service. Each call:
 * 1. Obtains a valid access token (proactive refresh if within 5-min buffer)
 * 2. Makes the API call
 * 3. On 401/403: attempts ONE token refresh + retry
 * 4. On repeated 401 after retry: marks connection as DISCONNECTED
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class XeroApiService {
    
    private final XeroOAuthService xeroOAuthService;
    private final XeroConnectionRepository xeroConnectionRepository;
    private final RestTemplate restTemplate;

    /**
     * Functional interface for Xero API calls that can be retried.
     */
    @FunctionalInterface
    private interface XeroApiCall<T> {
        T execute(String accessToken, String tenantId) throws Exception;
    }

    /**
     * Execute a Xero API call with automatic token refresh and retry on 401/403.
     * 
     * Strategy:
     * 1. Get valid access token (may proactively refresh)
     * 2. Execute the API call
     * 3. If 401/403: refresh token once and retry
     * 4. If retry also fails: mark DISCONNECTED and throw
     */
    private <T> T executeWithRetry(String tenantId, XeroApiCall<T> apiCall) {
        XeroConnection connection = xeroConnectionRepository.findFirstByTenantIdOrderByIdDesc(tenantId)
            .orElseThrow(() -> new RuntimeException("Xero connection not found for tenant: " + tenantId));

        // Check if connection is already disconnected
        if (!connection.isConnected()) {
            throw new RuntimeException("Xero connection is disconnected for tenant: " + tenantId + 
                ". Reason: " + connection.getDisconnectReason() + ". Please reconnect to Xero.");
        }

        String accessToken;
        try {
            accessToken = xeroOAuthService.getValidAccessToken(connection);
        } catch (Exception e) {
            log.error("Failed to get valid access token for tenant {}: {}", tenantId, e.getMessage());
            throw new RuntimeException("Failed to get valid access token. Please reconnect to Xero.", e);
        }

        try {
            // First attempt
            return apiCall.execute(accessToken, tenantId);
        } catch (HttpClientErrorException e) {
            int statusCode = e.getStatusCode().value();
            
            if (statusCode == 401 || statusCode == 403) {
                return retryAfterRefresh(tenantId, apiCall);
            }
            
            // Non-auth HTTP errors - throw as-is
            throw e;
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("Xero API call failed: " + e.getMessage(), e);
        }
    }

    /**
     * Retry an API call after refreshing the token. Called when the first attempt gets 401/403.
     */
    private <T> T retryAfterRefresh(String tenantId, XeroApiCall<T> apiCall) {
        log.warn("Xero API returned 401/403 for tenant {}. Attempting token refresh + retry...", tenantId);
        
        XeroConnection connection = xeroConnectionRepository.findFirstByTenantIdOrderByIdDesc(tenantId)
            .orElseThrow(() -> new RuntimeException("Connection not found during retry: " + tenantId));
        
        try {
            connection = xeroOAuthService.refreshTokens(connection);
            String newAccessToken = xeroOAuthService.getValidAccessToken(connection);
            
            log.info("Token refreshed for tenant {}. Retrying API call...", tenantId);
            
            return apiCall.execute(newAccessToken, tenantId);
        } catch (XeroOAuthService.InvalidGrantException ige) {
            log.error("Retry failed for tenant {}: refresh token invalid. Connection marked DISCONNECTED.", tenantId);
            throw new RuntimeException("Xero connection expired. Please reconnect to Xero.", ige);
        } catch (HttpClientErrorException retryEx) {
            int retryStatus = retryEx.getStatusCode().value();
            if (retryStatus == 401 || retryStatus == 403) {
                log.error("Retry also returned {} for tenant {}. Marking DISCONNECTED.", retryStatus, tenantId);
                xeroOAuthService.markConnectionDisconnected(connection.getId(), 
                    "api_call_failed_after_retry_" + retryStatus);
                throw new RuntimeException("Xero authentication failed after retry. Please reconnect to Xero.", retryEx);
            }
            throw new RuntimeException("Xero API error on retry: " + retryEx.getStatusCode(), retryEx);
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception retryEx) {
            log.error("Retry failed for tenant {}: {}", tenantId, retryEx.getMessage());
            throw new RuntimeException("Xero API call failed after retry: " + retryEx.getMessage(), retryEx);
        }
    }
    
    /**
     * Get accounts for a tenant (with retry on 401/403)
     */
    public XeroAccountResponse getAccounts(String tenantId) {
        return executeWithRetry(tenantId, (accessToken, tid) -> {
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(accessToken);
            headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
            headers.set("xero-tenant-id", tid);
            
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
        });
    }
    
    /**
     * Get invoices/bills for a tenant (with retry on 401/403)
     */
    public XeroInvoiceResponse getInvoices(String tenantId) {
        return executeWithRetry(tenantId, (accessToken, tid) -> {
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(accessToken);
            headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
            headers.set("xero-tenant-id", tid);
            
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
                        
                        if (invoiceMap.get("Date") != null) {
                            invoice.setDate(parseDate((String) invoiceMap.get("Date")));
                        }
                        if (invoiceMap.get("DueDate") != null) {
                            invoice.setDueDate(parseDate((String) invoiceMap.get("DueDate")));
                        }
                        
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
        });
    }

    /**
     * Get Balance Sheet report for a tenant as of a specific date.
     * Returns balance sheet account code, name, and amount.
     */
    public XeroBalanceSheetResponse getBalanceSheet(String tenantId, LocalDate asOfDate) {
        return executeWithRetry(tenantId, (accessToken, tid) -> {
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(accessToken);
            headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
            headers.set("xero-tenant-id", tid);

            String dateParam = asOfDate.toString();
            String encodedDate = java.net.URLEncoder.encode(dateParam, java.nio.charset.StandardCharsets.UTF_8);
            String url = XeroConfig.XERO_API_URL + "/Reports/BalanceSheet?date=" + encodedDate;
            log.info("Fetching Xero Balance Sheet for tenant {} with date={} (encoded: {})", tid, asOfDate, encodedDate);
            HttpEntity<String> entity = new HttpEntity<>(headers);
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                entity,
                new ParameterizedTypeReference<Map<String, Object>>() {}
            );

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                Map<String, Object> body = response.getBody();
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> reportsList = (List<Map<String, Object>>) body.get("Reports");
                if (reportsList == null || reportsList.isEmpty()) {
                    XeroBalanceSheetResponse result = new XeroBalanceSheetResponse();
                    result.setReportDate(asOfDate.toString());
                    result.setAccounts(Collections.emptyList());
                    return result;
                }

                Map<String, String> accountIdToCode = new HashMap<>();
                try {
                    XeroAccountResponse acctResp = getAccounts(tid);
                    if (acctResp != null && acctResp.getAccounts() != null) {
                        for (XeroAccountResponse.Account a : acctResp.getAccounts()) {
                            if (a.getAccountID() != null && a.getCode() != null) {
                                accountIdToCode.put(a.getAccountID(), a.getCode());
                            }
                        }
                    }
                } catch (Exception e) {
                    log.debug("Could not fetch accounts for code lookup: {}", e.getMessage());
                }

                List<XeroBalanceSheetResponse.BalanceSheetAccount> accounts = new ArrayList<>();
                Map<String, Object> report = reportsList.get(0);
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> rows = (List<Map<String, Object>>) report.get("Rows");
                if (rows != null) {
                    extractBalanceSheetAccounts(rows, accounts, accountIdToCode);
                }

                // Always use the date we requested for display (user selected this month end)
                String reportDateForResponse = asOfDate.toString();
                @SuppressWarnings("unchecked")
                List<String> reportTitles = (List<String>) report.get("ReportTitles");
                Object reportDateObj = report.get("ReportDate");
                log.info("Xero Balance Sheet requested={} Xero ReportDate={} ReportTitles={} accounts={}",
                    asOfDate, reportDateObj, reportTitles, accounts.size());

                XeroBalanceSheetResponse result = new XeroBalanceSheetResponse();
                result.setReportDate(reportDateForResponse);
                result.setAccounts(accounts);
                return result;
            }

            throw new RuntimeException("Failed to fetch balance sheet: " + response.getStatusCode());
        });
    }

    /**
     * Recursively extract balance sheet account rows from report structure.
     * Xero report has Section rows with nested Rows; Row type has Cells with account code, name, amount.
     */
    @SuppressWarnings("unchecked")
    private void extractBalanceSheetAccounts(List<Map<String, Object>> rows,
                                            List<XeroBalanceSheetResponse.BalanceSheetAccount> accounts,
                                            Map<String, String> accountIdToCode) {
        if (rows == null) return;
        for (Map<String, Object> row : rows) {
            String rowType = (String) row.get("RowType");
            if (rowType == null) rowType = "";

            if ("Row".equals(rowType) || "SummaryRow".equals(rowType)) {
                XeroBalanceSheetResponse.BalanceSheetAccount acc = parseBalanceSheetRow(row, accountIdToCode);
                if (acc != null) {
                    accounts.add(acc);
                }
            } else if ("Section".equals(rowType)) {
                List<Map<String, Object>> childRows = (List<Map<String, Object>>) row.get("Rows");
                extractBalanceSheetAccounts(childRows, accounts, accountIdToCode);
            }
        }
    }

    private XeroBalanceSheetResponse.BalanceSheetAccount parseBalanceSheetRow(Map<String, Object> row,
                                                                            Map<String, String> accountIdToCode) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> cells = (List<Map<String, Object>>) row.get("Cells");
        if (cells == null || cells.isEmpty()) return null;

        XeroBalanceSheetResponse.BalanceSheetAccount acc = new XeroBalanceSheetResponse.BalanceSheetAccount();
        String accountCode = null;
        String accountName = null;
        BigDecimal amount = BigDecimal.ZERO;

        // Some report formats expose Amount at row level
        Object rowAmount = row.get("Amount");
        if (rowAmount != null) {
            BigDecimal parsed = tryParseAmountFromValue(rowAmount);
            if (parsed != null) amount = parsed;
        }

        String accountIdFromAttributes = null;
        for (int i = 0; i < cells.size(); i++) {
            Map<String, Object> cell = cells.get(i);
            Object val = cell.get("Value");

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> attrs = (List<Map<String, Object>>) cell.get("Attributes");
            if (attrs != null) {
                for (Map<String, Object> attr : attrs) {
                    if ("account".equals(attr.get("Id"))) {
                        Object attrVal = attr.get("Value");
                        if (attrVal != null) accountIdFromAttributes = attrVal.toString();
                        break;
                    }
                }
            }

            // Amount: try Value as number first (API may return numeric type), then as string
            BigDecimal parsedAmount = tryParseAmountFromValue(val);
            if (parsedAmount != null) {
                amount = parsedAmount;
            }

            String strVal = (val != null && !"null".equals(val.toString())) ? val.toString().trim() : "";
            if (strVal.isEmpty()) continue;

            // Not a number - treat as account code or name
            if (i == 0) {
                if (strVal.matches("^[0-9]+$") || strVal.matches("^[0-9]+[A-Za-z]?$")) {
                    accountCode = strVal;
                } else {
                    accountName = strVal;
                    if (accountCode == null) accountCode = extractCodeFromParentheses(strVal);
                }
            } else if (accountName == null) {
                accountName = strVal;
                if (accountCode == null) accountCode = extractCodeFromParentheses(strVal);
            } else if (accountCode == null && strVal.matches("^[0-9]+[A-Za-z]?$")) {
                accountCode = strVal;
            }
        }

        if (accountCode == null && accountIdFromAttributes != null && accountIdToCode != null) {
            accountCode = accountIdToCode.get(accountIdFromAttributes);
        }
        acc.setAccountCode(accountCode != null ? accountCode : "");
        acc.setAccountName(accountName != null ? accountName : "");
        acc.setAmount(amount);
        return acc;
    }

    /** Parse amount from cell Value: handles Number type from API or string like "1,234.56" or "(1,234.56)". */
    private BigDecimal tryParseAmountFromValue(Object val) {
        if (val == null) return null;
        if (val instanceof Number) {
            return BigDecimal.valueOf(((Number) val).doubleValue());
        }
        String strVal = val.toString().trim();
        return tryParseAmount(strVal);
    }

    private BigDecimal tryParseAmount(String strVal) {
        if (strVal == null || strVal.isEmpty()) return null;
        try {
            String numStr = strVal.replace(",", "").replace("(", "-").replace(")", "").trim();
            if (numStr.isEmpty()) return null;
            return new BigDecimal(numStr);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Parse dates like "As at 28 February 2026", "28 February 2026", "15 June 2023", etc. */
    private LocalDate tryParseXeroReportDate(String dateStr) {
        if (dateStr == null || dateStr.isEmpty()) return null;
        String cleaned = dateStr.replaceFirst("(?i)^as at\\s+", "").trim();
        java.time.format.DateTimeFormatter[] formatters = {
            java.time.format.DateTimeFormatter.ofPattern("d MMMM yyyy", java.util.Locale.ENGLISH),
            java.time.format.DateTimeFormatter.ofPattern("dd MMMM yyyy", java.util.Locale.ENGLISH),
            java.time.format.DateTimeFormatter.ofPattern("d MMM yyyy", java.util.Locale.ENGLISH),
            java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd"),
        };
        for (var fmt : formatters) {
            try {
                return LocalDate.parse(cleaned, fmt);
            } catch (Exception ignored) {}
        }
        return null;
    }

    /** Extract account code from "Account Name (270)" or "Interest Income (270)" format */
    private String extractCodeFromParentheses(String str) {
        if (str == null) return null;
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("\\(([0-9]+[A-Za-z]?)\\)").matcher(str);
        return m.find() ? m.group(1) : null;
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
     * Create a manual journal in Xero (with retry on 401/403)
     */
    public ManualJournalResult createManualJournal(String tenantId, String narration, LocalDate journalDate,
                                     List<JournalLine> journalLines) {
        // Build journal request body once (reused on retry)
        Map<String, Object> journalRequest = new HashMap<>();
        Map<String, Object> manualJournal = new HashMap<>();
        manualJournal.put("Narration", narration);
        manualJournal.put("Date", journalDate.toString());
        manualJournal.put("Status", "POSTED");
        
        List<Map<String, Object>> journalLinesList = new ArrayList<>();
        for (JournalLine line : journalLines) {
            Map<String, Object> lineMap = new HashMap<>();
            lineMap.put("AccountCode", line.getAccountCode());
            lineMap.put("Description", line.getDescription());
            lineMap.put("LineAmount", line.getLineAmount().doubleValue());
            lineMap.put("TaxType", "NONE");
            journalLinesList.add(lineMap);
        }
        manualJournal.put("JournalLines", journalLinesList);
        journalRequest.put("ManualJournals", Collections.singletonList(manualJournal));
        
        log.info("Creating manual journal in Xero for tenant {}", tenantId);
        
        return executeWithRetry(tenantId, (accessToken, tid) -> {
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(accessToken);
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
            headers.set("xero-tenant-id", tid);
            
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(journalRequest, headers);
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                XeroConfig.XERO_API_URL + "/ManualJournals",
                HttpMethod.POST,
                entity,
                new ParameterizedTypeReference<Map<String, Object>>() {}
            );
            
            if (response.getStatusCode() == HttpStatus.OK || response.getStatusCode() == HttpStatus.CREATED) {
                Map<String, Object> body = response.getBody();
                if (body != null) {
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
                        
                        Object journalNumberObj = journal.get("JournalNumber");
                        if (journalNumberObj instanceof Integer) {
                            journalNumber = (Integer) journalNumberObj;
                        } else if (journalNumberObj instanceof String) {
                            try {
                                journalNumber = Integer.parseInt((String) journalNumberObj);
                            } catch (NumberFormatException ignored) {}
                        }
                        
                        Integer fetchedNumber = fetchJournalNumber(tid, journalId, accessToken);
                        if (fetchedNumber != null) {
                            journalNumber = fetchedNumber;
                        }
                        
                        log.info("Created manual journal in Xero. ID: {}, JournalNumber: {}", journalId, journalNumber);
                        return new ManualJournalResult(journalId, journalNumber);
                    } else {
                        throw new RuntimeException("No manual journal returned from Xero API");
                    }
                }
            }
            
            throw new RuntimeException("Failed to create manual journal: " + response.getStatusCode());
        });
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
    
    /**
     * Result class for voiding a manual journal
     */
    @Data
    @AllArgsConstructor
    public static class VoidJournalResult {
        private String journalId;
        private boolean success;
        private String status;
        private String errorMessage;
        private boolean periodLocked;
    }
    
    /**
     * Check if a manual journal can be voided (verifies period is not locked).
     * Returns information about the journal's current state.
     */
    public VoidJournalResult checkJournalCanBeVoided(String tenantId, String journalId) {
        return executeWithRetry(tenantId, (accessToken, tid) -> {
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(accessToken);
            headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
            headers.set("xero-tenant-id", tid);
            
            HttpEntity<Void> entity = new HttpEntity<>(headers);
            String url = XeroConfig.XERO_API_URL + "/ManualJournals/" + journalId;
            
            try {
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
                        String status = (String) journal.get("Status");
                        
                        if ("VOIDED".equalsIgnoreCase(status)) {
                            return new VoidJournalResult(journalId, true, status, "Journal already voided", false);
                        }
                        if ("POSTED".equalsIgnoreCase(status)) {
                            return new VoidJournalResult(journalId, true, status, null, false);
                        }
                        return new VoidJournalResult(journalId, false, status, "Journal status is " + status, false);
                    }
                }
                return new VoidJournalResult(journalId, false, null, "Journal not found in Xero", false);
            } catch (HttpClientErrorException e) {
                String responseBody = e.getResponseBodyAsString();
                log.warn("Error checking journal {}: {} - {}", journalId, e.getStatusCode(), responseBody);
                
                if (e.getStatusCode().value() == 404) {
                    return new VoidJournalResult(journalId, false, null, "Journal not found in Xero", false);
                }
                throw e;
            }
        });
    }
    
    /**
     * Void a manual journal in Xero by updating its status to VOIDED.
     * 
     * Xero requires a POST request to update the journal status, not DELETE.
     * The request body must include the ManualJournalID and Status: "VOIDED".
     * 
     * Returns a VoidJournalResult indicating success/failure and whether the period is locked.
     */
    public VoidJournalResult voidManualJournal(String tenantId, String journalId) {
        return executeWithRetry(tenantId, (accessToken, tid) -> {
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(accessToken);
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
            headers.set("xero-tenant-id", tid);
            
            // Build the request body to update status to VOIDED
            Map<String, Object> journalUpdate = new HashMap<>();
            journalUpdate.put("ManualJournalID", journalId);
            journalUpdate.put("Status", "VOIDED");
            
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("ManualJournals", Collections.singletonList(journalUpdate));
            
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
            String url = XeroConfig.XERO_API_URL + "/ManualJournals/" + journalId;
            
            log.info("Voiding manual journal {} in Xero for tenant {} (POST with Status=VOIDED)", journalId, tenantId);
            
            try {
                ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    entity,
                    new ParameterizedTypeReference<Map<String, Object>>() {}
                );
                
                if (response.getStatusCode() == HttpStatus.OK) {
                    // Check the response to confirm the journal was voided
                    Map<String, Object> body = response.getBody();
                    if (body != null) {
                        @SuppressWarnings("unchecked")
                        List<Map<String, Object>> journals = (List<Map<String, Object>>) body.get("ManualJournals");
                        if (journals != null && !journals.isEmpty()) {
                            Map<String, Object> journal = journals.get(0);
                            String status = (String) journal.get("Status");
                            
                            if ("VOIDED".equalsIgnoreCase(status)) {
                                log.info("Successfully voided manual journal {} in Xero", journalId);
                                return new VoidJournalResult(journalId, true, "VOIDED", null, false);
                            } else {
                                log.warn("Journal {} status after void request: {}", journalId, status);
                                return new VoidJournalResult(journalId, false, status, 
                                    "Journal status is " + status + " (expected VOIDED)", false);
                            }
                        }
                    }
                    // If we got 200 OK but can't verify status, assume success
                    log.info("Voided manual journal {} in Xero (response OK)", journalId);
                    return new VoidJournalResult(journalId, true, "VOIDED", null, false);
                }
                
                return new VoidJournalResult(journalId, false, null, 
                    "Unexpected response: " + response.getStatusCode(), false);
            } catch (HttpClientErrorException e) {
                String responseBody = e.getResponseBodyAsString();
                int statusCode = e.getStatusCode().value();
                
                log.error("Error voiding journal {} in Xero: {} - {}", journalId, statusCode, responseBody);
                
                // Check for locked period error
                boolean periodLocked = responseBody.toLowerCase().contains("period is locked") ||
                                      responseBody.toLowerCase().contains("locked period") ||
                                      responseBody.toLowerCase().contains("lock date");
                
                if (periodLocked) {
                    return new VoidJournalResult(journalId, false, null, 
                        "The accounting period is locked in Xero. Please unlock the period in Xero first.", true);
                }
                
                // Check if journal was not found (404)
                if (statusCode == 404 || responseBody.toLowerCase().contains("not found")) {
                    return new VoidJournalResult(journalId, false, null, 
                        "Journal not found in Xero (may have been deleted)", false);
                }
                
                // Check if journal is already voided
                if (responseBody.toLowerCase().contains("already voided") || 
                    responseBody.toLowerCase().contains("status is voided")) {
                    return new VoidJournalResult(journalId, true, "VOIDED", "Journal was already voided", false);
                }
                
                // Check for validation errors in the response
                if (responseBody.contains("ValidationErrors")) {
                    return new VoidJournalResult(journalId, false, null, 
                        "Xero validation error: " + responseBody, false);
                }
                
                return new VoidJournalResult(journalId, false, null, 
                    "Failed to void journal: " + e.getMessage(), false);
            }
        });
    }
}

