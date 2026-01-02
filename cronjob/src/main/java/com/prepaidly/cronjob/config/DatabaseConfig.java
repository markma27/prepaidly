package com.prepaidly.cronjob.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;

/**
 * Database configuration and connection management.
 */
public class DatabaseConfig {
    private static final Logger log = LoggerFactory.getLogger(DatabaseConfig.class);
    private static HikariDataSource dataSource;
    
    /**
     * Initialize database connection pool.
     */
    public static void initialize() {
        if (dataSource != null) {
            return;
        }
        
        String dbUrl = System.getenv("DATABASE_URL");
        String dbUsername = System.getenv("DB_USERNAME");
        String dbPassword = System.getenv("DB_PASSWORD");
        
        if (dbUrl == null || dbUrl.isEmpty()) {
            throw new IllegalStateException("DATABASE_URL environment variable is not set");
        }
        
        // Parse DATABASE_URL if it's a full connection string (postgresql://user:pass@host:port/db)
        // Otherwise use it as-is and get credentials from separate env vars
        String jdbcUrl = dbUrl;
        String username = dbUsername;
        String password = dbPassword;
        
        if (dbUrl.startsWith("postgresql://") || dbUrl.startsWith("postgres://")) {
            // Parse PostgreSQL connection string
            try {
                java.net.URI uri = new java.net.URI(dbUrl.replace("postgresql://", "http://").replace("postgres://", "http://"));
                String userInfo = uri.getUserInfo();
                
                if (userInfo != null && userInfo.contains(":")) {
                    String[] credentials = userInfo.split(":", 2);
                    if (username == null || username.isEmpty()) {
                        username = credentials[0];
                    }
                    if (password == null || password.isEmpty()) {
                        password = credentials[1];
                    }
                }
                
                // Build JDBC URL
                String host = uri.getHost();
                int port = uri.getPort() > 0 ? uri.getPort() : 5432;
                String path = uri.getPath();
                if (path.startsWith("/")) {
                    path = path.substring(1);
                }
                
                // Build JDBC URL without credentials (we'll set them separately)
                jdbcUrl = String.format("jdbc:postgresql://%s:%d/%s", host, port, path);
                
                // Add query parameters if present
                if (uri.getQuery() != null && !uri.getQuery().isEmpty()) {
                    jdbcUrl += "?" + uri.getQuery();
                }
                
                log.info("Parsed DATABASE_URL: host={}, port={}, database={}", host, port, path);
            } catch (Exception e) {
                log.warn("Failed to parse DATABASE_URL as connection string, using as-is: {}", e.getMessage());
                // If parsing fails, try to use as JDBC URL directly
                if (!dbUrl.startsWith("jdbc:")) {
                    jdbcUrl = "jdbc:" + dbUrl;
                }
            }
        } else if (!dbUrl.startsWith("jdbc:")) {
            // If it doesn't start with jdbc:, assume it needs the prefix
            jdbcUrl = "jdbc:" + dbUrl;
        }
        
        // Default username if not provided
        if (username == null || username.isEmpty()) {
            username = "postgres";
        }
        
        // Default password if not provided
        if (password == null) {
            password = "";
        }
        
        HikariConfig config = new HikariConfig();
        
        // Ensure JDBC URL format is correct
        if (!jdbcUrl.startsWith("jdbc:postgresql://")) {
            throw new IllegalStateException("Invalid JDBC URL format: " + jdbcUrl);
        }
        
        config.setJdbcUrl(jdbcUrl);
        config.setUsername(username);
        config.setPassword(password);
        config.setDriverClassName("org.postgresql.Driver");
        config.setMaximumPoolSize(5);
        config.setMinimumIdle(1);
        config.setConnectionTimeout(30000);
        config.setIdleTimeout(600000);
        config.setMaxLifetime(1800000);
        
        // Log connection info (without password)
        log.info("Initializing database connection pool");
        log.info("JDBC URL: {}", maskPassword(jdbcUrl));
        log.info("Username: {}", username);
        log.info("Password set: {}", password != null && !password.isEmpty());
        
        try {
            dataSource = new HikariDataSource(config);
            log.info("Database connection pool initialized successfully");
        } catch (Exception e) {
            log.error("Failed to initialize database connection pool", e);
            log.error("JDBC URL: {}", maskPassword(jdbcUrl));
            log.error("Username: {}", username);
            throw e;
        }
    }
    
    /**
     * Get database connection.
     */
    public static Connection getConnection() throws SQLException {
        if (dataSource == null) {
            initialize();
        }
        return dataSource.getConnection();
    }
    
    /**
     * Get data source.
     */
    public static DataSource getDataSource() {
        if (dataSource == null) {
            initialize();
        }
        return dataSource;
    }
    
    /**
     * Close database connection pool.
     */
    public static void close() {
        if (dataSource != null) {
            dataSource.close();
            log.info("Database connection pool closed");
        }
    }
    
    /**
     * Mask password in connection string for logging.
     */
    private static String maskPassword(String url) {
        if (url == null) {
            return null;
        }
        return url.replaceAll("password=[^&;\\s]*", "password=***")
                   .replaceAll(":([^:@/]+)@", ":***@");
    }
}

