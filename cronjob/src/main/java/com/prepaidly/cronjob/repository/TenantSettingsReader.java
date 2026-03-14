package com.prepaidly.cronjob.repository;

import com.prepaidly.cronjob.config.DatabaseConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

/**
 * Repository class for reading tenant settings from the database.
 * Used by the cron job to get conversion date per tenant.
 */
public class TenantSettingsReader {
    private static final Logger log = LoggerFactory.getLogger(TenantSettingsReader.class);

    /**
     * Read conversion date for all tenants.
     *
     * @return Map of tenantId to conversion date (null if not set)
     * @throws SQLException if database access fails
     */
    public Map<String, LocalDate> readConversionDatesByTenant() throws SQLException {
        log.info("Reading tenant settings (conversion dates) from database...");
        Map<String, LocalDate> result = new HashMap<>();

        String sql = "SELECT tenant_id, conversion_date FROM tenant_settings WHERE conversion_date IS NOT NULL";

        try {
            Connection connection = DatabaseConfig.getConnection();
            PreparedStatement stmt = connection.prepareStatement(sql);
            ResultSet rs = stmt.executeQuery();

            while (rs.next()) {
                String tenantId = rs.getString("tenant_id");
                LocalDate conversionDate = rs.getObject("conversion_date", LocalDate.class);
                if (tenantId != null && conversionDate != null) {
                    result.put(tenantId, conversionDate);
                }
            }

            rs.close();
            stmt.close();
            connection.close();

            log.info("Read conversion dates for {} tenants", result.size());
        } catch (SQLException e) {
            log.error("Error reading tenant settings", e);
            throw e;
        }

        return result;
    }
}
