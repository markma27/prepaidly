package com.prepaidly.cronjob.repository;

import com.prepaidly.cronjob.config.DatabaseConfig;
import com.prepaidly.model.Schedule;
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
 * Repository class for reading schedules from the database.
 * Provides methods to query and retrieve schedule data.
 */
public class ScheduleReader {
    private static final Logger log = LoggerFactory.getLogger(ScheduleReader.class);
    
    /**
     * Read all schedules from the database and store them in a set.
     * 
     * @return Set of schedules
     * @throws SQLException if database access fails
     */
    public Set<Schedule> readAll() throws SQLException {
        log.info("Starting to read schedules from database...");
        Set<Schedule> scheduleSet = new HashSet<>();
        
        String sql = "SELECT id, tenant_id, xero_invoice_id, type, start_date, end_date, " +
                     "total_amount, expense_acct_code, revenue_acct_code, deferral_acct_code, " +
                     "created_by, created_at FROM schedules";
        
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
                Schedule schedule = new Schedule();
                schedule.setId(rs.getLong("id"));
                schedule.setTenantId(rs.getString("tenant_id"));
                schedule.setXeroInvoiceId(rs.getString("xero_invoice_id"));
                
                // Convert String to ScheduleType enum
                String typeStr = rs.getString("type");
                if (typeStr != null) {
                    try {
                        schedule.setType(Schedule.ScheduleType.valueOf(typeStr));
                    } catch (IllegalArgumentException e) {
                        log.warn("Invalid schedule type '{}' for schedule ID {}, skipping", typeStr, schedule.getId());
                        continue;
                    }
                }
                
                schedule.setStartDate(rs.getObject("start_date", LocalDate.class));
                schedule.setEndDate(rs.getObject("end_date", LocalDate.class));
                
                BigDecimal totalAmount = rs.getBigDecimal("total_amount");
                schedule.setTotalAmount(totalAmount);
                
                schedule.setExpenseAcctCode(rs.getString("expense_acct_code"));
                schedule.setRevenueAcctCode(rs.getString("revenue_acct_code"));
                schedule.setDeferralAcctCode(rs.getString("deferral_acct_code"));
                
                Long createdBy = rs.getLong("created_by");
                if (rs.wasNull()) {
                    schedule.setCreatedBy(null);
                } else {
                    schedule.setCreatedBy(createdBy);
                }
                
                schedule.setCreatedAt(rs.getObject("created_at", LocalDateTime.class));
                
                scheduleSet.add(schedule);
            }
            
            log.info("Successfully processed {} rows from database", rowCount);
            log.info("Total schedules in set: {}", scheduleSet.size());
            
            rs.close();
            stmt.close();
            connection.close();
            log.info("Database resources closed successfully");
            
        } catch (SQLException e) {
            log.error("=== SQL Exception while reading schedules ===");
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
            log.error("=== Unexpected Exception while reading schedules ===");
            log.error("Exception type: {}", e.getClass().getName());
            log.error("Exception message: {}", e.getMessage());
            log.error("Full stack trace:", e);
            throw new SQLException("Unexpected error reading schedules", e);
        }
        
        return scheduleSet;
    }
}

