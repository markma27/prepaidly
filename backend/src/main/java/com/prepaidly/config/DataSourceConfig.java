package com.prepaidly.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

/**
 * DataSource configuration that ensures prepareThreshold=0 is added to JDBC URL
 * to prevent "prepared statement already exists" errors with connection pooling.
 * 
 * This is especially important when using PostgreSQL with connection pooling
 * (like Supabase's pgBouncer) where prepared statements can conflict.
 */
@Configuration
@EnableConfigurationProperties
public class DataSourceConfig {
    private static final Logger log = LoggerFactory.getLogger(DataSourceConfig.class);
    
    @Autowired
    private DataSourceProperties dataSourceProperties;
    
    @Bean
    @Primary
    public HikariDataSource dataSource(HikariConfig hikariConfig) {
        String jdbcUrl = dataSourceProperties.getUrl();
        
        // Ensure prepareThreshold=0 is added to prevent prepared statement conflicts
        if (jdbcUrl != null && !jdbcUrl.contains("prepareThreshold")) {
            if (jdbcUrl.contains("?")) {
                jdbcUrl += "&prepareThreshold=0";
            } else {
                jdbcUrl += "?prepareThreshold=0";
            }
            log.info("Added prepareThreshold=0 to JDBC URL to prevent prepared statement conflicts");
            log.debug("Modified JDBC URL: {}", maskPassword(jdbcUrl));
        } else if (jdbcUrl != null && jdbcUrl.contains("prepareThreshold")) {
            log.debug("JDBC URL already contains prepareThreshold parameter");
        }
        
        // Create a new HikariConfig based on the configured one, but with modified URL
        HikariConfig config = new HikariConfig();
        // Copy all properties from the configured HikariConfig
        config.setJdbcUrl(jdbcUrl); // Use modified URL
        config.setUsername(dataSourceProperties.getUsername());
        config.setPassword(dataSourceProperties.getPassword());
        config.setDriverClassName(dataSourceProperties.getDriverClassName());
        
        // Copy HikariCP pool properties from the configured HikariConfig
        config.setMaximumPoolSize(hikariConfig.getMaximumPoolSize());
        config.setMinimumIdle(hikariConfig.getMinimumIdle());
        config.setConnectionTimeout(hikariConfig.getConnectionTimeout());
        config.setIdleTimeout(hikariConfig.getIdleTimeout());
        config.setMaxLifetime(hikariConfig.getMaxLifetime());
        
        // Create HikariDataSource from the new config
        return new HikariDataSource(config);
    }
    
    @Bean
    @ConfigurationProperties("spring.datasource.hikari")
    public HikariConfig hikariConfig() {
        return new HikariConfig();
    }
    
    /**
     * Mask password in connection string for logging.
     */
    private String maskPassword(String url) {
        if (url == null) {
            return null;
        }
        return url.replaceAll("password=[^&;\\s]*", "password=***")
                   .replaceAll(":([^:@/]+)@", ":***@");
    }
}
