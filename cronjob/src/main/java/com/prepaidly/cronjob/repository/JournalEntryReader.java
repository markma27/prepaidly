package com.prepaidly.cronjob.repository;

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
import java.util.HashSet;
import java.util.Set;

/**
 * Repository class for reading journal entries from the database.
 * Provides methods to query and retrieve journal entry data.
 */
public class JournalEntryReader {
    private static final Logger log = LoggerFactory.getLogger(JournalEntryReader.class);
    
    /**
     * Read all journal entries from the database and store them in a set.
     * 
     * @return Set of journal entries
     * @throws SQLException if database access fails
     */
    public Set<JournalEntry> readAll() throws SQLException {
        log.info("Starting to read journal entries from database...");
        Set<JournalEntry> journalEntrySet = new HashSet<>();
        
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
                
                journalEntrySet.add(entry);
            }
            
            log.info("Successfully processed {} rows from database", rowCount);
            log.info("Total journal entries in set: {}", journalEntrySet.size());
            
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
        
        return journalEntrySet;
    }
}

