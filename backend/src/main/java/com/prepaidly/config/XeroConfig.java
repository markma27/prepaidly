package com.prepaidly.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "xero")
@Data
public class XeroConfig {
    private String clientId;
    private String clientSecret;
    private String redirectUri;
    
    // Xero OAuth2 endpoints
    public static final String XERO_AUTH_URL = "https://login.xero.com/identity/connect/authorize";
    public static final String XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
    public static final String XERO_API_URL = "https://api.xero.com/api.xro/2.0";
    
    // Required scopes for MVP
    public static final String[] REQUIRED_SCOPES = {
        "offline_access",
        "accounting.settings.read",
        "accounting.contacts.read",
        "accounting.transactions",
        "accounting.journals.read"
    };
}

