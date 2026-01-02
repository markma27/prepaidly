package com.prepaidly.cronjob;

import com.prepaidly.cronjob.config.DatabaseConfig;
import com.prepaidly.cronjob.model.JournalEntry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * Daily Cron Job
 * 
 * Executes daily tasks at 12:00 AM. This job can be scheduled to run
 * automatically on Railway or other platforms.
 * 
 * Customize the run() method to add your daily maintenance tasks.
 */
public class DailyCronJob {
    private static final Logger log = LoggerFactory.getLogger(DailyCronJob.class);
    
    public static void main(String[] args) {
        DailyCronJob job = new DailyCronJob();
        try {
            job.run();
            System.exit(0);
        } catch (Exception e) {
            log.error("Daily cron job failed", e);
            System.exit(1);
        } finally {
            DatabaseConfig.close();
        }
    }
    
    /**
     * Execute daily tasks
     * 
     * Add your daily maintenance tasks here, such as:
     * - Refreshing Xero tokens
     * - Generating scheduled journal entries
     * - Sending notifications
     * - Cleaning up old data
     * - Running maintenance tasks
     */
    public void run() {
        log.info("=== Daily Cron Job Started ===");
        
        try {
            // Read all journal entries and store in map
            Map<String, JournalEntry> journalEntryMap = readJournalEntries();
            log.info("Loaded {} journal entries from database", journalEntryMap.size());
            
            // Log xero_manual_journal_id and posted status for all journal entries
            logJournalEntries(journalEntryMap);
            
            // TODO: Add your daily tasks here using the journalEntryMap
            // Example tasks:
            // - Refresh Xero tokens for all tenants
            // - Generate journal entries for schedules due today
            // - Send reminder notifications
            // - Clean up old data
            
        } catch (SQLException e) {
            log.error("Database error executing daily tasks", e);
            throw new RuntimeException("Failed to read journal entries", e);
        } catch (Exception e) {
            log.error("Error executing daily tasks", e);
            throw e;
        }
        
        log.info("Daily cron job completed successfully");
        log.info("=== Daily Cron Job Finished ===");
    }
    
    /**
     * Read all journal entries from the database and store them in a map.
     * Key: xero_manual_journal_id, Value: JournalEntry object
     * 
     * @return Map of journal entries keyed by xero_manual_journal_id
     * @throws SQLException if database access fails
     */
    private Map<String, JournalEntry> readJournalEntries() throws SQLException {
        Map<String, JournalEntry> journalEntryMap = new HashMap<>();
        
        String sql = "SELECT id, schedule_id, period_date, amount, xero_manual_journal_id, posted, created_at " +
                     "FROM journal_entries";
        
        try (Connection connection = DatabaseConfig.getConnection();
             PreparedStatement stmt = connection.prepareStatement(sql);
             ResultSet rs = stmt.executeQuery()) {
            
            while (rs.next()) {
                JournalEntry entry = new JournalEntry();
                entry.setId(rs.getLong("id"));
                
                Long scheduleId = rs.getLong("schedule_id");
                if (!rs.wasNull()) {
                    entry.setScheduleId(scheduleId);
                }
                
                entry.setPeriodDate(rs.getObject("period_date", LocalDate.class));
                
                BigDecimal amount = rs.getBigDecimal("amount");
                entry.setAmount(amount);
                
                String xeroManualJournalId = rs.getString("xero_manual_journal_id");
                entry.setXeroManualJournalId(xeroManualJournalId);
                
                entry.setPosted(rs.getBoolean("posted"));
                entry.setCreatedAt(rs.getObject("created_at", LocalDateTime.class));
                
                // Use xero_manual_journal_id as key (null values will be stored as "null" key)
                String key = xeroManualJournalId != null ? xeroManualJournalId : "null_" + entry.getId();
                journalEntryMap.put(key, entry);
            }
            
            log.info("Successfully loaded {} journal entries", journalEntryMap.size());
        }
        
        return journalEntryMap;
    }
    
    /**
     * Log xero_manual_journal_id and posted status for all journal entries.
     * 
     * @param journalEntryMap Map of journal entries keyed by xero_manual_journal_id
     */
    private void logJournalEntries(Map<String, JournalEntry> journalEntryMap) {
        log.info("=== Journal Entries Summary ===");
        log.info("Total entries: {}", journalEntryMap.size());
        
        int postedCount = 0;
        int notPostedCount = 0;
        int withXeroIdCount = 0;
        int withoutXeroIdCount = 0;
        
        for (Map.Entry<String, JournalEntry> entry : journalEntryMap.entrySet()) {
            JournalEntry journalEntry = entry.getValue();
            String xeroManualJournalId = journalEntry.getXeroManualJournalId();
            Boolean posted = journalEntry.getPosted();
            
            // Log each entry
            log.info("Journal Entry ID: {}, Xero Manual Journal ID: {}, Posted: {}", 
                    journalEntry.getId(), 
                    xeroManualJournalId != null ? xeroManualJournalId : "null",
                    posted != null ? posted : "null");
            
            // Count statistics
            if (posted != null && posted) {
                postedCount++;
            } else {
                notPostedCount++;
            }
            
            if (xeroManualJournalId != null && !xeroManualJournalId.isEmpty()) {
                withXeroIdCount++;
            } else {
                withoutXeroIdCount++;
            }
        }
        
        log.info("=== Journal Entries Statistics ===");
        log.info("Posted entries: {}", postedCount);
        log.info("Not posted entries: {}", notPostedCount);
        log.info("Entries with Xero Journal ID: {}", withXeroIdCount);
        log.info("Entries without Xero Journal ID: {}", withoutXeroIdCount);
        log.info("=== End Summary ===");
    }
}

