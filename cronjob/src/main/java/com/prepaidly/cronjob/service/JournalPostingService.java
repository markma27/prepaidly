package com.prepaidly.cronjob.service;

import com.prepaidly.cronjob.config.DatabaseConfig;
import com.prepaidly.cronjob.repository.XeroConnectionReader;
import com.prepaidly.model.JournalEntry;
import com.prepaidly.model.Schedule;
import com.prepaidly.model.XeroConnection;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.List;

/**
 * Service for posting journal entries to Xero.
 * Handles the business logic of posting journals and updating the database.
 */
public class JournalPostingService {
    private static final Logger log = LoggerFactory.getLogger(JournalPostingService.class);
    
    private final XeroApiService xeroApiService;
    private final XeroConnectionReader xeroConnectionReader;
    
    public JournalPostingService(XeroApiService xeroApiService, XeroConnectionReader xeroConnectionReader) {
        this.xeroApiService = xeroApiService;
        this.xeroConnectionReader = xeroConnectionReader;
    }
    
    /**
     * Post a journal entry to Xero.
     * 
     * @param entry The journal entry to post
     * @param schedule The schedule this entry belongs to
     * @return The Xero manual journal ID
     * @throws RuntimeException if posting fails
     */
    public String postJournal(JournalEntry entry, Schedule schedule) {
        String tenantId = schedule.getTenantId();
        
        // Verify Xero connection exists
        try {
            XeroConnection connection = xeroConnectionReader.readByTenantId(tenantId);
            if (connection == null) {
                throw new RuntimeException("Xero connection not found for tenant: " + tenantId);
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to read Xero connection: " + e.getMessage(), e);
        }
        
        // Check if already posted
        if (entry.getPosted() != null && entry.getPosted()) {
            log.warn("Journal entry {} already posted, skipping", entry.getId());
            return entry.getXeroManualJournalId();
        }
        
        // Build journal lines
        List<XeroApiService.JournalLine> journalLines = xeroApiService.buildJournalLines(schedule, entry);
        
        // Create narration
        String narration = String.format(
            "%s Recognition - %s (Period: %s)",
            schedule.getType() == Schedule.ScheduleType.PREPAID ? "Prepaid Expense" : "Unearned Revenue",
            schedule.getType() == Schedule.ScheduleType.PREPAID ? "Expense" : "Revenue",
            entry.getPeriodDate().toString()
        );
        
        try {
            // Create manual journal in Xero
            String xeroJournalId = xeroApiService.createManualJournal(
                tenantId,
                narration,
                entry.getPeriodDate(),
                journalLines
            );
            
            // Update journal entry in database
            updateJournalEntry(entry.getId(), xeroJournalId, true);
            
            log.info("Successfully posted journal entry {} to Xero with journal ID: {}", entry.getId(), xeroJournalId);
            return xeroJournalId;
            
        } catch (Exception e) {
            log.error("Error posting journal entry {} to Xero", entry.getId(), e);
            throw new RuntimeException("Failed to post journal to Xero: " + e.getMessage(), e);
        }
    }
    
    /**
     * Update journal entry in database after posting to Xero.
     */
    private void updateJournalEntry(Long journalEntryId, String xeroManualJournalId, boolean posted) throws SQLException {
        String sql = "UPDATE journal_entries SET xero_manual_journal_id = ?, posted = ? WHERE id = ?";
        
        try {
            Connection connection = DatabaseConfig.getConnection();
            PreparedStatement stmt = connection.prepareStatement(sql);
            stmt.setString(1, xeroManualJournalId);
            stmt.setBoolean(2, posted);
            stmt.setLong(3, journalEntryId);
            
            int rowsUpdated = stmt.executeUpdate();
            if (rowsUpdated != 1) {
                throw new SQLException("Expected to update 1 row, but updated " + rowsUpdated);
            }
            
            stmt.close();
            connection.close();
            
            log.debug("Updated journal entry {} with Xero journal ID: {}", journalEntryId, xeroManualJournalId);
            
        } catch (SQLException e) {
            log.error("Error updating journal entry {} in database", journalEntryId, e);
            throw e;
        }
    }
}

