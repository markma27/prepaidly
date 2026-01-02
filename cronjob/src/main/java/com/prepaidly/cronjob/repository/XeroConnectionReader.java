package com.prepaidly.cronjob.repository;

import com.prepaidly.cronjob.config.DatabaseConfig;
import com.prepaidly.model.XeroConnection;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;

/**
 * Repository class for reading Xero connections from the database.
 */
public class XeroConnectionReader {
    private static final Logger log = LoggerFactory.getLogger(XeroConnectionReader.class);
    
    /**
     * Read Xero connection by tenant ID.
     * 
     * @param tenantId The tenant ID to look up
     * @return XeroConnection if found, null otherwise
     * @throws SQLException if database access fails
     */
    public XeroConnection readByTenantId(String tenantId) throws SQLException {
        log.info("Reading Xero connection for tenant: {}", tenantId);
        
        String sql = "SELECT id, user_id, tenant_id, tenant_name, access_token, refresh_token, " +
                     "expires_at, created_at, updated_at FROM xero_connections WHERE tenant_id = ?";
        
        try {
            Connection connection = DatabaseConfig.getConnection();
            PreparedStatement stmt = connection.prepareStatement(sql);
            stmt.setString(1, tenantId);
            
            ResultSet rs = stmt.executeQuery();
            
            if (rs.next()) {
                XeroConnection xeroConnection = new XeroConnection();
                xeroConnection.setId(rs.getLong("id"));
                
                Long userId = rs.getLong("user_id");
                if (!rs.wasNull()) {
                    xeroConnection.setUserId(userId);
                }
                
                xeroConnection.setTenantId(rs.getString("tenant_id"));
                xeroConnection.setTenantName(rs.getString("tenant_name"));
                
                String accessToken = rs.getString("access_token");
                String refreshToken = rs.getString("refresh_token");
                
                // Log token details for debugging (without exposing full tokens)
                if (accessToken != null) {
                    log.debug("Access token length: {}, starts with: {}", 
                        accessToken.length(), 
                        accessToken.length() > 10 ? accessToken.substring(0, 10) + "..." : accessToken);
                }
                if (refreshToken != null) {
                    log.debug("Refresh token length: {}, starts with: {}", 
                        refreshToken.length(), 
                        refreshToken.length() > 10 ? refreshToken.substring(0, 10) + "..." : refreshToken);
                }
                
                xeroConnection.setAccessToken(accessToken);
                xeroConnection.setRefreshToken(refreshToken);
                xeroConnection.setExpiresAt(rs.getObject("expires_at", LocalDateTime.class));
                xeroConnection.setCreatedAt(rs.getObject("created_at", LocalDateTime.class));
                xeroConnection.setUpdatedAt(rs.getObject("updated_at", LocalDateTime.class));
                
                rs.close();
                stmt.close();
                connection.close();
                
                log.info("Found Xero connection for tenant: {}", tenantId);
                return xeroConnection;
            }
            
            rs.close();
            stmt.close();
            connection.close();
            
            log.warn("No Xero connection found for tenant: {}", tenantId);
            return null;
            
        } catch (SQLException e) {
            log.error("Error reading Xero connection for tenant {}", tenantId, e);
            throw e;
        }
    }
}

