package com.prepaidly.cronjob;

import com.prepaidly.cronjob.config.DatabaseConfig;
import com.prepaidly.cronjob.repository.JournalEntryReader;
import com.prepaidly.cronjob.repository.ScheduleReader;
import com.prepaidly.model.JournalEntry;
import com.prepaidly.model.Schedule;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.SQLException;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;

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
            // Read all journal entries and store in set
            JournalEntryReader journalEntryReader = new JournalEntryReader();
            Set<JournalEntry> journalEntrySet = journalEntryReader.readAll();
            log.info("Successfully loaded {} journal entries from database", journalEntrySet.size());
            
            log.info("Step 2.5: Reading schedules from database...");
            // Read all schedules and store in set
            ScheduleReader scheduleReader = new ScheduleReader();
            Set<Schedule> scheduleSet = scheduleReader.readAll();
            log.info("Successfully loaded {} schedules from database", scheduleSet.size());
            
            log.info("Step 3: Logging journal entries...");
            // Log xero_manual_journal_id and posted status for all journal entries
            logJournalEntries(journalEntrySet);
            
            log.info("Step 4: Filtering journal entries ready to post...");
            // Create a set of journal entries whose period_date equals or before current date and not posted yet
            Set<JournalEntry> entriesToPost = filterEntriesReadyToPost(journalEntrySet);
            log.info("Found {} journal entries ready to post", entriesToPost.size());
            
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
     * Log xero_manual_journal_id and posted status for all journal entries.
     * 
     * @param journalEntrySet Set of journal entries
     */
    private void logJournalEntries(Set<JournalEntry> journalEntrySet) {
        log.info("=== Journal Entries Summary ===");
        log.info("Total entries: {}", journalEntrySet.size());
        
        int postedCount = 0;
        int notPostedCount = 0;
        
        for (JournalEntry journalEntry : journalEntrySet) {
            Boolean posted = journalEntry.getPosted();
            
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
    
    /**
     * Filter journal entries that are ready to be posted.
     * An entry is ready if:
     * - period_date is less than or equal to the current system date
     * - posted is false or null (not posted yet)
     * 
     * @param journalEntrySet Set of all journal entries
     * @return Set of journal entries ready to post
     */
    private Set<JournalEntry> filterEntriesReadyToPost(Set<JournalEntry> journalEntrySet) {
        log.info("Filtering journal entries ready to post...");
        LocalDate currentDate = LocalDate.now();
        log.info("Current system date: {}", currentDate);
        
        Set<JournalEntry> entriesToPost = new HashSet<>();
        
        for (JournalEntry entry : journalEntrySet) {
            LocalDate periodDate = entry.getPeriodDate();
            Boolean posted = entry.getPosted();
            
            // Check if period_date is null (shouldn't happen, but defensive check)
            if (periodDate == null) {
                log.warn("Journal entry ID {} has null period_date, skipping", entry.getId());
                continue;
            }
            
            // Check if period_date is less than or equal to current date
            boolean isPeriodDateValid = !periodDate.isAfter(currentDate);
            
            // Check if not posted yet (posted is false or null)
            boolean isNotPosted = posted == null || !posted;
            
            if (isPeriodDateValid && isNotPosted) {
                entriesToPost.add(entry);
                log.debug("Journal entry ID {} (period_date: {}, posted: {}) is ready to post", 
                        entry.getId(), periodDate, posted);
            }
        }
        
        log.info("Filtered {} journal entries ready to post out of {} total entries", 
                entriesToPost.size(), journalEntrySet.size());
        
        return entriesToPost;
    }
}

