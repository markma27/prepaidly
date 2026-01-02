package com.prepaidly.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;

/**
 * Xero connection entity storing OAuth tokens for a connected Xero organization.
 * Simplified version for cronjob (no JPA annotations, plain POJO).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class XeroConnection {
    /** Unique identifier for the connection */
    private Long id;

    /** User ID who owns this Xero connection */
    private Long userId;

    /** Xero tenant/organization ID */
    private String tenantId;

    /** Xero tenant/organization name */
    private String tenantName;

    /** OAuth access token (encrypted, expires after 30 minutes) */
    private String accessToken; // Encrypted

    /** OAuth refresh token (encrypted, used to get new access tokens) */
    private String refreshToken; // Encrypted

    /** When the access token expires */
    private LocalDateTime expiresAt;

    /** Timestamp when the connection was created */
    private LocalDateTime createdAt;

    /** Timestamp when the connection was last updated */
    private LocalDateTime updatedAt;
}

