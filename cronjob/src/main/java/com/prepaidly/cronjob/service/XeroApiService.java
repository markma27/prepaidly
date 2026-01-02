package com.prepaidly.cronjob.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prepaidly.cronjob.repository.XeroConnectionReader;
import com.prepaidly.model.JournalEntry;
import com.prepaidly.model.Schedule;
import com.prepaidly.model.XeroConnection;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.sql.SQLException;
import java.time.Duration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Service for interacting with Xero API.
 * Simplified version for cronjob - only handles posting manual journals.
 */
public class XeroApiService {
    private static final Logger log = LoggerFactory.getLogger(XeroApiService.class);
    
    private static final String XERO_API_URL = "https://api.xero.com/api.xro/2.0";
    
    private final XeroConnectionReader xeroConnectionReader;
    private final XeroOAuthService xeroOAuthService;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    
    public XeroApiService(XeroConnectionReader xeroConnectionReader, XeroOAuthService xeroOAuthService) {
        this.xeroConnectionReader = xeroConnectionReader;
        this.xeroOAuthService = xeroOAuthService;
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();
        this.objectMapper = new ObjectMapper();
        
        log.info("XeroApiService initialized");
    }
    
    /**
     * Create a manual journal in Xero.
     * 
     * @param tenantId The Xero tenant ID
     * @param narration The journal narration/description
     * @param journalDate The journal date
     * @param journalLines The journal lines (debits and credits)
     * @return The Xero manual journal ID
     * @throws RuntimeException if creation fails
     */
    public String createManualJournal(String tenantId, String narration, LocalDate journalDate,
                                     List<JournalLine> journalLines) {
        try {
            // Get Xero connection
            XeroConnection connection;
            try {
                connection = xeroConnectionReader.readByTenantId(tenantId);
            } catch (SQLException e) {
                throw new RuntimeException("Failed to read Xero connection: " + e.getMessage(), e);
            }
            if (connection == null) {
                throw new RuntimeException("Xero connection not found for tenant: " + tenantId);
            }
            
            // Get valid access token
            String accessToken = xeroOAuthService.getValidAccessToken(connection);
            
            // Build journal request
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
            
            journalRequest.put("ManualJournals", List.of(manualJournal));
            
            log.info("Creating manual journal in Xero for tenant {}: {}", tenantId, journalRequest);
            
            // Convert to JSON
            String requestBody = objectMapper.writeValueAsString(journalRequest);
            
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(XERO_API_URL + "/ManualJournals"))
                .header("Authorization", "Bearer " + accessToken)
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .header("xero-tenant-id", tenantId)
                .POST(HttpRequest.BodyPublishers.ofString(requestBody, StandardCharsets.UTF_8))
                .timeout(Duration.ofSeconds(30))
                .build();
            
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            
            log.info("Xero API response status: {}", response.statusCode());
            log.debug("Xero API response body: {}", response.body());
            
            if (response.statusCode() == 200 || response.statusCode() == 201) {
                JsonNode jsonResponse = objectMapper.readTree(response.body());
                
                // Check for validation errors
                JsonNode validationErrors = jsonResponse.get("ValidationErrors");
                if (validationErrors != null && validationErrors.isArray() && validationErrors.size() > 0) {
                    StringBuilder errorMsg = new StringBuilder("Xero validation errors: ");
                    for (JsonNode error : validationErrors) {
                        if (error.has("Message")) {
                            errorMsg.append(error.get("Message").asText()).append("; ");
                        }
                    }
                    log.error("Xero validation errors: {}", validationErrors);
                    throw new RuntimeException(errorMsg.toString());
                }
                
                JsonNode journals = jsonResponse.get("ManualJournals");
                if (journals != null && journals.isArray() && journals.size() > 0) {
                    String journalId = journals.get(0).get("ManualJournalID").asText();
                    log.info("Successfully created manual journal in Xero with ID: {}", journalId);
                    return journalId;
                } else {
                    log.error("No ManualJournals in response. Response keys: {}", jsonResponse.fieldNames());
                    throw new RuntimeException("No manual journal returned from Xero API");
                }
            }
            
            log.error("Failed to create manual journal. Status: {}, Body: {}", response.statusCode(), response.body());
            throw new RuntimeException("Failed to create manual journal: " + response.statusCode() + ". Response: " + response.body());
            
        } catch (IOException | InterruptedException e) {
            log.error("Error creating manual journal for tenant {}", tenantId, e);
            throw new RuntimeException("Failed to create manual journal: " + e.getMessage(), e);
        }
    }
    
    /**
     * Build journal lines based on schedule type and journal entry.
     */
    public List<JournalLine> buildJournalLines(Schedule schedule, JournalEntry entry) {
        List<JournalLine> lines = new ArrayList<>();
        
        if (schedule.getType() == Schedule.ScheduleType.PREPAID) {
            // Prepaid Expense: Debit Expense, Credit Deferral
            JournalLine expenseLine = new JournalLine();
            expenseLine.setAccountCode(schedule.getExpenseAcctCode());
            expenseLine.setDescription("Prepaid expense recognition");
            expenseLine.setLineAmount(entry.getAmount());
            lines.add(expenseLine);
            
            JournalLine deferralLine = new JournalLine();
            deferralLine.setAccountCode(schedule.getDeferralAcctCode());
            deferralLine.setDescription("Prepaid expense deferral reduction");
            deferralLine.setLineAmount(entry.getAmount().negate());
            lines.add(deferralLine);
        } else {
            // Unearned Revenue: Debit Deferral, Credit Revenue
            JournalLine deferralLine = new JournalLine();
            deferralLine.setAccountCode(schedule.getDeferralAcctCode());
            deferralLine.setDescription("Unearned revenue recognition");
            deferralLine.setLineAmount(entry.getAmount().negate());
            lines.add(deferralLine);
            
            JournalLine revenueLine = new JournalLine();
            revenueLine.setAccountCode(schedule.getRevenueAcctCode());
            revenueLine.setDescription("Unearned revenue recognition");
            revenueLine.setLineAmount(entry.getAmount());
            lines.add(revenueLine);
        }
        
        return lines;
    }
    
    /**
     * Journal line for manual journal creation.
     */
    public static class JournalLine {
        private String accountCode;
        private String description;
        private BigDecimal lineAmount;
        
        public String getAccountCode() {
            return accountCode;
        }
        
        public void setAccountCode(String accountCode) {
            this.accountCode = accountCode;
        }
        
        public String getDescription() {
            return description;
        }
        
        public void setDescription(String description) {
            this.description = description;
        }
        
        public BigDecimal getLineAmount() {
            return lineAmount;
        }
        
        public void setLineAmount(BigDecimal lineAmount) {
            this.lineAmount = lineAmount;
        }
    }
}

