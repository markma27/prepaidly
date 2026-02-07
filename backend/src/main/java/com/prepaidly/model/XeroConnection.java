package com.prepaidly.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;

/**
 * Xero connection entity storing OAuth tokens for a connected Xero organization.
 * Tokens are encrypted before storage.
 * 
 * Token lifecycle:
 * - Access tokens expire after 30 minutes
 * - Refresh tokens expire after 60 days of inactivity
 * - Refresh token rotation: each refresh returns a NEW refresh token that must be stored
 * - connection_status tracks whether the connection is usable or needs re-authorization
 */
@Entity
@Table(name = "xero_connections")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class XeroConnection {

    /** Connection status constants */
    public static final String STATUS_CONNECTED = "CONNECTED";
    public static final String STATUS_DISCONNECTED = "DISCONNECTED";

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

    /** Xero tenant/organization name (stored for display when tokens expire) */
    @Column(name = "tenant_name")
    private String tenantName;

    /** OAuth access token (encrypted, expires after 30 minutes) */
    @Column(name = "access_token", nullable = false, length = 2000)
    private String accessToken; // Encrypted

    /** OAuth refresh token (encrypted, used to get new access tokens) */
    @Column(name = "refresh_token", nullable = false, length = 2000)
    private String refreshToken; // Encrypted

    /** When the access token expires */
    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    /** Connection status: CONNECTED or DISCONNECTED */
    @Column(name = "connection_status", nullable = false, length = 20)
    private String connectionStatus = STATUS_CONNECTED;

    /** Reason the connection was disconnected (null when connected) */
    @Column(name = "disconnect_reason", length = 500)
    private String disconnectReason;

    /** OAuth scopes granted during authorization (space-separated) */
    @Column(name = "scopes", columnDefinition = "TEXT")
    private String scopes;

    /** Xero-side connection UUID from /connections endpoint */
    @Column(name = "xero_connection_id")
    private String xeroConnectionId;

    /** When tokens were last successfully refreshed */
    @Column(name = "last_refreshed_at")
    private LocalDateTime lastRefreshedAt;

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
        if (connectionStatus == null) {
            connectionStatus = STATUS_CONNECTED;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    /** Convenience: is this connection currently usable? */
    public boolean isConnected() {
        return STATUS_CONNECTED.equals(connectionStatus);
    }

    /** Mark this connection as disconnected with a reason */
    public void markDisconnected(String reason) {
        this.connectionStatus = STATUS_DISCONNECTED;
        this.disconnectReason = reason;
    }

    /** Mark this connection as connected (clear disconnect reason) */
    public void markConnected() {
        this.connectionStatus = STATUS_CONNECTED;
        this.disconnectReason = null;
    }
}

