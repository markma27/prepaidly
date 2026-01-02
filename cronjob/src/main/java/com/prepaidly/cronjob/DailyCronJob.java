package com.prepaidly.cronjob;

import com.prepaidly.cronjob.config.DatabaseConfig;
import com.prepaidly.model.JournalEntry;
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
        log.info("=== Daily Cron Job Application Starting ===");
        log.info("Java version: {}", System.getProperty("java.version"));
        log.info("Java home: {}", System.getProperty("java.home"));
        log.info("Working directory: {}", System.getProperty("user.dir"));
        
        DailyCronJob job = new DailyCronJob();
        try {
            log.info("Initializing cron job...");
            job.run();
            log.info("Cron job completed successfully, exiting with code 0");
            System.exit(0);
        } catch (Exception e) {
            log.error("=== Daily Cron Job Failed ===");
            log.error("Exception type: {}", e.getClass().getName());
            log.error("Exception message: {}", e.getMessage());
            if (e.getCause() != null) {
                log.error("Cause: {}", e.getCause().getClass().getName());
                log.error("Cause message: {}", e.getCause().getMessage());
            }
            log.error("Full stack trace:", e);
            System.err.println("ERROR: " + e.getMessage());
            e.printStackTrace(System.err);
            System.exit(1);
        } finally {
            log.info("Cleaning up resources...");
            try {
                DatabaseConfig.close();
            } catch (Exception e) {
                log.error("Error closing database connection", e);
            }
            log.info("=== Daily Cron Job Application Exiting ===");
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
            log.info("Step 1: Initializing database connection...");
            // Initialize database connection early to catch errors
            DatabaseConfig.initialize();
            log.info("Database connection initialized successfully");
            
            log.info("Step 2: Reading journal entries from database...");
            // Read all journal entries and store in map
            Map<String, JournalEntry> journalEntryMap = readJournalEntries();
            log.info("Successfully loaded {} journal entries from database", journalEntryMap.size());
            
            log.info("Step 3: Logging journal entries...");
            // Log xero_manual_journal_id and posted status for all journal entries
            logJournalEntries(journalEntryMap);
            
            log.info("All steps completed successfully");
        } catch (SQLException e) {
            log.error("=== SQL Exception in Daily Tasks ===");
            log.error("SQL State: {}", e.getSQLState());
            log.error("Error Code: {}", e.getErrorCode());
            log.error("Error Message: {}", e.getMessage());
            if (e.getCause() != null) {
                log.error("Cause: {}", e.getCause().getMessage());
            }
            log.error("Full stack trace:", e);
            throw new RuntimeException("Failed to read journal entries", e);
        } catch (Exception e) {
            log.error("=== Exception in Daily Tasks ===");
            log.error("Exception type: {}", e.getClass().getName());
            log.error("Exception message: {}", e.getMessage());
            if (e.getCause() != null) {
                log.error("Cause type: {}", e.getCause().getClass().getName());
                log.error("Cause message: {}", e.getCause().getMessage());
            }
            log.error("Full stack trace:", e);
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
        log.info("Starting to read journal entries from database...");
        Map<String, JournalEntry> journalEntryMap = new HashMap<>();
        
        String sql = "SELECT id, schedule_id, period_date, amount, xero_manual_journal_id, posted, created_at " +
                     "FROM journal_entries";
        
        log.info("SQL Query: {}", sql);
        
        try {
            log.info("Getting database connection...");
            Connection connection = DatabaseConfig.getConnection();
            log.info("Database connection obtained successfully");
            
            log.info("Creating prepared statement...");
            PreparedStatement stmt = connection.prepareStatement(sql);
            log.info("Prepared statement created successfully");
            
            log.info("Executing query...");
            ResultSet rs = stmt.executeQuery();
            log.info("Query executed successfully, processing results...");
            
            int rowCount = 0;
            while (rs.next()) {
                rowCount++;
                if (rowCount % 100 == 0) {
                    log.debug("Processed {} rows so far...", rowCount);
                }
                JournalEntry entry = new JournalEntry();
                entry.setId(rs.getLong("id"));
                
                // Note: Schedule relationship is not loaded via JDBC, only schedule_id is available
                // The Schedule field will remain null as we're using JDBC directly, not JPA
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
            
            log.info("Successfully processed {} rows from database", rowCount);
            log.info("Total journal entries in map: {}", journalEntryMap.size());
            
            rs.close();
            stmt.close();
            connection.close();
            log.info("Database resources closed successfully");
            
        } catch (SQLException e) {
            log.error("=== SQL Exception while reading journal entries ===");
            log.error("SQL State: {}", e.getSQLState());
            log.error("Error Code: {}", e.getErrorCode());
            log.error("Error Message: {}", e.getMessage());
            if (e.getCause() != null) {
                log.error("Cause: {}", e.getCause().getMessage());
            }
            log.error("SQL Query: {}", sql);
            log.error("Full stack trace:", e);
            throw e;
        } catch (Exception e) {
            log.error("=== Unexpected Exception while reading journal entries ===");
            log.error("Exception type: {}", e.getClass().getName());
            log.error("Exception message: {}", e.getMessage());
            log.error("Full stack trace:", e);
            throw new SQLException("Unexpected error reading journal entries", e);
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
        }
        
        log.info("=== Journal Entries Statistics ===");
        log.info("Posted entries: {}", postedCount);
        log.info("Not posted entries: {}", notPostedCount);
        log.info("=== End Summary ===");
    }
}

