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
 * 
 * Note: Currently uses username/password authentication via environment variables.
 * Future improvement: Consider using Railway service account or IAM-based authentication
 * for enhanced security when running as a scheduled job.
 */
public class DatabaseConfig {
    private static final Logger log = LoggerFactory.getLogger(DatabaseConfig.class);
    private static HikariDataSource dataSource;
    
    /**
     * Initialize database connection pool.
     */
    public static void initialize() {
        log.info("=== Database Initialization Started ===");
        
        if (dataSource != null) {
            log.info("Database connection pool already initialized, skipping");
            return;
        }
        
        try {
            log.info("Reading environment variables...");
            String dbUrl = System.getenv("DATABASE_URL");
            String dbUsername = System.getenv("DB_USERNAME");
            String dbPassword = System.getenv("DB_PASSWORD");
            
            log.info("DATABASE_URL is set: {}", dbUrl != null && !dbUrl.isEmpty());
            log.info("DB_USERNAME is set: {}", dbUsername != null && !dbUsername.isEmpty());
            log.info("DB_PASSWORD is set: {}", dbPassword != null && !dbPassword.isEmpty());
            
            if (dbUrl == null || dbUrl.isEmpty()) {
                log.error("DATABASE_URL environment variable is not set!");
                throw new IllegalStateException("DATABASE_URL environment variable is not set");
            }
            
            // Parse DATABASE_URL if it's a full connection string (postgresql://user:pass@host:port/db)
            // Otherwise use it as-is and get credentials from separate env vars
            log.info("Parsing DATABASE_URL...");
            String jdbcUrl = dbUrl;
            String username = dbUsername;
            String password = dbPassword;
            
            if (dbUrl.startsWith("postgresql://") || dbUrl.startsWith("postgres://")) {
                log.info("Detected PostgreSQL connection string format, parsing...");
                // Parse PostgreSQL connection string
                try {
                    java.net.URI uri = new java.net.URI(dbUrl.replace("postgresql://", "http://").replace("postgres://", "http://"));
                    String userInfo = uri.getUserInfo();
                    
                    log.info("Parsed URI - host: {}, port: {}, path: {}", uri.getHost(), uri.getPort(), uri.getPath());
                    
                    if (userInfo != null && userInfo.contains(":")) {
                        String[] credentials = userInfo.split(":", 2);
                        if (username == null || username.isEmpty()) {
                            username = credentials[0];
                            log.info("Extracted username from connection string");
                        }
                        if (password == null || password.isEmpty()) {
                            password = credentials[1];
                            log.info("Extracted password from connection string");
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
                    log.error("Failed to parse DATABASE_URL as connection string: {}", e.getMessage(), e);
                    // If parsing fails, try to use as JDBC URL directly
                    if (!dbUrl.startsWith("jdbc:")) {
                        jdbcUrl = "jdbc:" + dbUrl;
                        log.info("Added jdbc: prefix to URL");
                    }
                }
            } else if (!dbUrl.startsWith("jdbc:")) {
                log.info("Adding jdbc: prefix to URL");
                // If it doesn't start with jdbc:, assume it needs the prefix
                jdbcUrl = "jdbc:" + dbUrl;
            } else {
                log.info("DATABASE_URL already in JDBC format");
            }
            
            // Default username if not provided
            if (username == null || username.isEmpty()) {
                log.warn("DB_USERNAME not set, using default 'postgres'");
                username = "postgres";
            }
            
            // Default password if not provided
            if (password == null) {
                log.warn("DB_PASSWORD not set, using empty password");
                password = "";
            }
            
            log.info("Final connection parameters:");
            log.info("  JDBC URL: {}", maskPassword(jdbcUrl));
            log.info("  Username: {}", username);
        
            log.info("Creating HikariCP configuration...");
            HikariConfig config = new HikariConfig();
            
            // Ensure JDBC URL format is correct
            if (!jdbcUrl.startsWith("jdbc:postgresql://")) {
                log.error("Invalid JDBC URL format: {}", jdbcUrl);
                throw new IllegalStateException("Invalid JDBC URL format: " + jdbcUrl);
            }
            
            log.info("Setting HikariCP connection pool properties...");
            config.setJdbcUrl(jdbcUrl);
            config.setUsername(username);
            config.setPassword(password);
            config.setDriverClassName("org.postgresql.Driver");
            config.setMaximumPoolSize(5);
            config.setMinimumIdle(1);
            config.setConnectionTimeout(30000);
            config.setIdleTimeout(600000);
            config.setMaxLifetime(1800000);
            
            log.info("HikariCP configuration created successfully");
            log.info("Attempting to create HikariDataSource...");
            
            dataSource = new HikariDataSource(config);
            log.info("HikariDataSource created successfully");
            
            // Test the connection
            log.info("Testing database connection...");
            try (Connection testConn = dataSource.getConnection()) {
                boolean valid = testConn.isValid(5);
                log.info("Connection test result: {}", valid);
                if (valid) {
                    log.info("Database connection pool initialized and tested successfully");
                } else {
                    log.error("Connection test failed - connection is not valid");
                    throw new SQLException("Database connection test failed");
                }
            } catch (SQLException e) {
                log.error("Failed to test database connection", e);
                log.error("SQL State: {}", e.getSQLState());
                log.error("Error Code: {}", e.getErrorCode());
                log.error("Error Message: {}", e.getMessage());
                if (e.getCause() != null) {
                    log.error("Cause: {}", e.getCause().getMessage());
                }
                throw new RuntimeException("Database connection test failed", e);
            }
        } catch (Exception e) {
            log.error("=== Fatal Error in Database Initialization ===");
            log.error("Error: {}", e.getMessage(), e);
            throw e;
        }
        
        log.info("=== Database Initialization Completed Successfully ===");
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

