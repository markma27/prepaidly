package com.prepaidly.cronjob;

import com.prepaidly.cronjob.config.DatabaseConfig;
import com.prepaidly.cronjob.repository.JournalEntryReader;
import com.prepaidly.cronjob.repository.ScheduleReader;
import com.prepaidly.cronjob.repository.XeroConnectionReader;
import com.prepaidly.cronjob.service.EncryptionService;
import com.prepaidly.cronjob.service.JournalPostingService;
import com.prepaidly.cronjob.service.XeroApiService;
import com.prepaidly.cronjob.service.XeroOAuthService;
import com.prepaidly.model.JournalEntry;
import com.prepaidly.model.Schedule;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.InputStream;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Properties;
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
        // Force immediate output for Railway
        System.out.println("=== Daily Cron Job Application Starting ===");
        System.out.flush();
        
        log.info("=== Daily Cron Job Application Starting ===");
        log.info("Java version: {}", System.getProperty("java.version"));
        log.info("Java home: {}", System.getProperty("java.home"));
        log.info("Working directory: {}", System.getProperty("user.dir"));
        
        // Force flush after initial logs
        System.out.flush();
        System.err.flush();
        
        DailyCronJob job = new DailyCronJob();
        try {
            log.info("Initializing cron job...");
            System.out.flush();
            job.run();
            log.info("Cron job completed successfully, exiting with code 0");
            System.out.println("=== Daily Cron Job Completed Successfully ===");
            System.out.flush();
            System.exit(0);
        } catch (Exception e) {
            System.err.println("=== Daily Cron Job Failed ===");
            System.err.println("Exception type: " + e.getClass().getName());
            System.err.println("Exception message: " + e.getMessage());
            System.err.flush();
            
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
            System.err.flush();
            System.exit(1);
        } finally {
            log.info("Cleaning up resources...");
            try {
                DatabaseConfig.close();
            } catch (Exception e) {
                log.error("Error closing database connection", e);
            }
            log.info("=== Daily Cron Job Application Exiting ===");
            System.out.flush();
            System.err.flush();
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
        System.out.println("=== Daily Cron Job Started ===");
        System.out.flush();
        log.info("=== Daily Cron Job Started ===");
        
        try {
            System.out.println("Step 1: Initializing database connection...");
            System.out.flush();
            log.info("Step 1: Initializing database connection...");
            // Initialize database connection early to catch errors
            DatabaseConfig.initialize();
            System.out.println("Database connection initialized successfully");
            System.out.flush();
            log.info("Database connection initialized successfully");
            
            System.out.println("Step 2: Reading journal entries from database...");
            System.out.flush();
            log.info("Step 2: Reading journal entries from database...");
            // Read all journal entries and store in set
            JournalEntryReader journalEntryReader = new JournalEntryReader();
            Set<JournalEntry> journalEntrySet = journalEntryReader.readAll();
            System.out.println("Successfully loaded " + journalEntrySet.size() + " journal entries from database");
            System.out.flush();
            log.info("Successfully loaded {} journal entries from database", journalEntrySet.size());
            
            System.out.println("Step 2.5: Reading schedules from database...");
            System.out.flush();
            log.info("Step 2.5: Reading schedules from database...");
            // Read all schedules and store in set
            ScheduleReader scheduleReader = new ScheduleReader();
            Set<Schedule> scheduleSet = scheduleReader.readAll();
            System.out.println("Successfully loaded " + scheduleSet.size() + " schedules from database");
            System.out.flush();
            log.info("Successfully loaded {} schedules from database", scheduleSet.size());
            
            System.out.println("Step 3: Logging journal entries...");
            System.out.flush();
            log.info("Step 3: Logging journal entries...");
            // Log xero_manual_journal_id and posted status for all journal entries
            logJournalEntries(journalEntrySet);
            
            System.out.println("Step 4: Filtering journal entries ready to post...");
            System.out.flush();
            log.info("Step 4: Filtering journal entries ready to post...");
            // Create a set of journal entries whose period_date equals or before current date and not posted yet
            Set<JournalEntry> entriesToPost = filterEntriesReadyToPost(journalEntrySet);
            System.out.println("Found " + entriesToPost.size() + " journal entries ready to post");
            System.out.flush();
            log.info("Found {} journal entries ready to post", entriesToPost.size());
            
            if (!entriesToPost.isEmpty()) {
                System.out.println("Step 5: Posting journal entries to Xero...");
                System.out.flush();
                log.info("Step 5: Posting journal entries to Xero...");
                
                // Initialize Xero services
                Properties props = loadProperties();
                String xeroClientId = props.getProperty("xero.client.id", System.getenv("XERO_CLIENT_ID"));
                String xeroClientSecret = props.getProperty("xero.client.secret", System.getenv("XERO_CLIENT_SECRET"));
                // Try both environment variable names for compatibility
                String jasyptPassword = props.getProperty("jasypt.encryptor.password", 
                    System.getenv("JASYPT_ENCRYPTOR_PASSWORD") != null 
                        ? System.getenv("JASYPT_ENCRYPTOR_PASSWORD")
                        : System.getenv("JASYPT_PASSWORD"));
                
                // Log configuration status (without exposing secrets)
                log.info("Xero Client ID configured: {}", xeroClientId != null && !xeroClientId.isEmpty());
                log.info("Xero Client Secret configured: {}", xeroClientSecret != null && !xeroClientSecret.isEmpty());
                log.info("Jasypt password configured: {}", jasyptPassword != null && !jasyptPassword.isEmpty());
                if (jasyptPassword != null) {
                    log.info("Jasypt password length: {}", jasyptPassword.length());
                }
                
                if (xeroClientId == null || xeroClientId.isEmpty()) {
                    throw new RuntimeException("Missing XERO_CLIENT_ID environment variable");
                }
                if (xeroClientSecret == null || xeroClientSecret.isEmpty()) {
                    throw new RuntimeException("Missing XERO_CLIENT_SECRET environment variable");
                }
                if (jasyptPassword == null || jasyptPassword.isEmpty()) {
                    throw new RuntimeException("Missing JASYPT_PASSWORD or JASYPT_ENCRYPTOR_PASSWORD environment variable. " +
                        "This must match the password used to encrypt tokens in the backend. " +
                        "Check your Railway environment variables and ensure it matches the backend's JASYPT_PASSWORD.");
                }
                
                EncryptionService encryptionService = new EncryptionService(jasyptPassword);
                XeroConnectionReader xeroConnectionReader = new XeroConnectionReader();
                XeroOAuthService xeroOAuthService = new XeroOAuthService(xeroClientId, xeroClientSecret, encryptionService);
                XeroApiService xeroApiService = new XeroApiService(xeroConnectionReader, xeroOAuthService);
                JournalPostingService journalPostingService = new JournalPostingService(xeroApiService, xeroConnectionReader);
                
                // Create schedule map by ID for quick lookup
                Map<Long, Schedule> scheduleMap = new HashMap<>();
                for (Schedule schedule : scheduleSet) {
                    scheduleMap.put(schedule.getId(), schedule);
                }
                
                // Post each journal entry
                int successCount = 0;
                int failureCount = 0;
                
                for (JournalEntry entry : entriesToPost) {
                    try {
                        Schedule schedule = scheduleMap.get(entry.getScheduleId());
                        if (schedule == null) {
                            log.error("Schedule not found for journal entry {} (schedule_id: {})", entry.getId(), entry.getScheduleId());
                            failureCount++;
                            continue;
                        }
                        
                        String xeroJournalId = journalPostingService.postJournal(entry, schedule);
                        System.out.println("Posted journal entry " + entry.getId() + " to Xero with journal ID: " + xeroJournalId);
                        System.out.flush();
                        successCount++;
                        
                    } catch (Exception e) {
                        log.error("Failed to post journal entry {} to Xero", entry.getId(), e);
                        System.err.println("Failed to post journal entry " + entry.getId() + ": " + e.getMessage());
                        System.err.flush();
                        failureCount++;
                    }
                }
                
                System.out.println("Journal posting completed. Success: " + successCount + ", Failures: " + failureCount);
                System.out.flush();
                log.info("Journal posting completed. Success: {}, Failures: {}", successCount, failureCount);
            } else {
                System.out.println("No journal entries to post");
                System.out.flush();
                log.info("No journal entries to post");
            }
            
            System.out.println("All steps completed successfully");
            System.out.flush();
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
        
        System.out.println("Daily cron job completed successfully");
        System.out.println("=== Daily Cron Job Finished ===");
        System.out.flush();
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
    
    /**
     * Load application properties from classpath.
     */
    private Properties loadProperties() {
        Properties props = new Properties();
        try {
            InputStream inputStream = getClass().getClassLoader().getResourceAsStream("application.properties");
            if (inputStream != null) {
                props.load(inputStream);
                inputStream.close();
            }
        } catch (Exception e) {
            log.warn("Failed to load application.properties, using environment variables only", e);
        }
        return props;
    }
}

