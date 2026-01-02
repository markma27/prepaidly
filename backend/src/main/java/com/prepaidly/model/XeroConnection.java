package com.prepaidly.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;

/**
 * Xero connection entity storing OAuth tokens for a connected Xero organization.
 * Tokens are encrypted before storage.
 */
@Entity
@Table(name = "xero_connections")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class XeroConnection {
    /** Unique identifier for the connection */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** User who owns this Xero connection */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** Xero tenant/organization ID */
    @Column(name = "tenant_id", nullable = false)
    private String tenantId;

    /** OAuth access token (encrypted, expires after 30 minutes) */
    @Column(name = "access_token", nullable = false, length = 2000)
    private String accessToken; // Encrypted

    /** OAuth refresh token (encrypted, used to get new access tokens) */
    @Column(name = "refresh_token", nullable = false, length = 2000)
    private String refreshToken; // Encrypted

    /** When the access token expires */
    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    /** Timestamp when the connection was created */
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    /** Timestamp when the connection was last updated */
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}

