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
        log.info("=== Daily Cron Job Application Starting ===");
        log.info("Java version: {}", System.getProperty("java.version"));
        log.info("Java home: {}", System.getProperty("java.home"));
        log.info("Working directory: {}", System.getProperty("user.dir"));
        
        DailyCronJob job = new DailyCronJob();
        try {
            log.info("Initializing cron job...");
            job.run();
            log.info("Cron job completed successfully, exiting with code 0");
        } catch (Exception e) {            
            log.error("=== Daily Cron Job Failed ===");
            log.error("Exception type: {}", e.getClass().getName());
            log.error("Exception message: {}", e.getMessage());
            if (e.getCause() != null) {
                log.error("Cause: {}", e.getCause().getClass().getName());
                log.error("Cause message: {}", e.getCause().getMessage());
            }
            log.error("Full stack trace:", e);
            
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
            log.info("Initializing database connection...");
            // Initialize database connection early to catch errors
            DatabaseConfig.initialize();
            log.info("Database connection initialized successfully");
            
            log.info("Reading journal entries from database...");
            // Read all journal entries and store in set
            JournalEntryReader journalEntryReader = new JournalEntryReader();
            Set<JournalEntry> journalEntrySet = journalEntryReader.readAll();
            log.info("Successfully loaded {} journal entries from database", journalEntrySet.size());
            

            log.info("Reading schedules from database...");
            // Read all schedules and store in set
            ScheduleReader scheduleReader = new ScheduleReader();
            Set<Schedule> scheduleSet = scheduleReader.readAll();
            log.info("Successfully loaded {} schedules from database", scheduleSet.size());
            

            // Log xero_manual_journal_id and posted status for all journal entries
            logJournalEntries(journalEntrySet);
            
            log.info("Filtering journal entries ready to post...");
            // Create a set of journal entries whose period_date equals or before current date and not posted yet
            Set<JournalEntry> entriesToPost = filterEntriesReadyToPost(journalEntrySet);
            log.info("Found {} journal entries ready to post", entriesToPost.size());
            
            if (!entriesToPost.isEmpty()) {
                log.info("Posting journal entries to Xero...");
                
                // Initialize Xero services
                Properties props = loadProperties();
                String xeroClientId = getPropertyOrEnv(props, "xero.client.id", "XERO_CLIENT_ID");
                String xeroClientSecret = getPropertyOrEnv(props, "xero.client.secret", "XERO_CLIENT_SECRET");
                // Read JASYPT_PASSWORD environment variable
                // IMPORTANT: Prioritize environment variable, then check properties file
                // Do NOT trim - Spring @Value doesn't trim, so we must match exactly
                String jasyptPassword = getPropertyOrEnv(props, "jasypt.encryptor.password", "JASYPT_PASSWORD");
                
                // Log configuration status (without exposing secrets)
                log.info("Xero Client ID configured: {}", xeroClientId != null && !xeroClientId.isEmpty());
                log.info("Xero Client Secret configured: {}", xeroClientSecret != null && !xeroClientSecret.isEmpty());
                log.info("Jasypt password configured: {}", jasyptPassword != null && !jasyptPassword.isEmpty());
                String jasyptPasswordSource = System.getenv("JASYPT_PASSWORD") != null ? "JASYPT_PASSWORD (env var)" : 
                    (props.getProperty("jasypt.encryptor.password") != null && 
                     !props.getProperty("jasypt.encryptor.password").contains("${")) ? 
                    "application.properties" : "NONE";
                log.info("Jasypt password source: {}", jasyptPasswordSource);
                
                if (jasyptPassword != null) {
                    // Check for leading/trailing whitespace (for debugging)
                    String trimmed = jasyptPassword.trim();
                    if (!jasyptPassword.equals(trimmed)) {
                        log.warn("Password has leading/trailing whitespace (length: {} -> {} after trim)", 
                            jasyptPassword.length(), trimmed.length());
                        log.warn("NOTE: Backend uses password as-is (no trim), so whitespace will be preserved");
                    }
                    
                    // Check for non-printable characters
                    boolean hasNonPrintable = false;
                    for (char c : jasyptPassword.toCharArray()) {
                        if (!Character.isLetterOrDigit(c) && !Character.isWhitespace(c) && 
                            c < 32 && c != '\t' && c != '\n' && c != '\r') {
                            hasNonPrintable = true;
                            break;
                        }
                    }
                    if (hasNonPrintable) {
                        log.warn("Password contains non-printable characters - this may cause issues");
                    }
                }
                
                if (xeroClientId == null || xeroClientId.isEmpty()) {
                    throw new RuntimeException("Missing XERO_CLIENT_ID environment variable");
                }
                if (xeroClientSecret == null || xeroClientSecret.isEmpty()) {
                    throw new RuntimeException("Missing XERO_CLIENT_SECRET environment variable");
                }
                if (jasyptPassword == null || jasyptPassword.isEmpty()) {
                    throw new RuntimeException("Missing JASYPT_PASSWORD environment variable. " +
                        "This must match the password used to encrypt tokens in the backend. " +
                        "Set JASYPT_PASSWORD in Railway environment variables to match the backend's JASYPT_PASSWORD.");
                }
                
                // Test encryption service first
                log.info("Testing encryption service with provided password...");
                try {
                    com.prepaidly.cronjob.util.PasswordDiagnostic.testEncryptionService(jasyptPassword);
                } catch (Exception e) {
                    log.error("Encryption service test failed - password may be incorrect", e);
                    throw new RuntimeException("Encryption service test failed. Please verify JASYPT_PASSWORD matches the backend exactly.", e);
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
                        
                        journalPostingService.postJournal(entry, schedule);
                        successCount++;
                        
                    } catch (Exception e) {
                        log.error("Failed to post journal entry {} to Xero", entry.getId(), e);
                        failureCount++;
                    }
                }
                log.info("Journal posting completed. Success: {}, Failures: {}", successCount, failureCount);
            } else {
                log.info("No journal entries to post");
            }
            
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
    
    /**
     * Get property value from properties file or environment variable.
     * Prioritizes environment variable, then checks properties file.
     * If property value looks like a placeholder (contains ${}), it's ignored.
     * 
     * @param props Properties object loaded from application.properties
     * @param propertyKey Key in properties file
     * @param envVarName Environment variable name
     * @return Property value, or null if not found
     */
    private String getPropertyOrEnv(Properties props, String propertyKey, String envVarName) {
        // First, check environment variable (highest priority)
        String envValue = System.getenv(envVarName);
        if (envValue != null && !envValue.isEmpty()) {
            return envValue;
        }
        
        // Then check properties file
        String propValue = props.getProperty(propertyKey);
        if (propValue != null && !propValue.isEmpty()) {
            // If it looks like a placeholder (e.g., ${VAR:default}), ignore it
            // This happens because we're not using Spring Boot's property resolution
            if (propValue.contains("${") && propValue.contains("}")) {
                log.debug("Property {} contains placeholder syntax, ignoring: {}", propertyKey, propValue);
                return null;
            }
            return propValue;
        }
        
        return null;
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

