package com.prepaidly.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;

/**
 * User entity representing a user account in the system.
 */
@Entity
@Table(name = "users")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class User {
    /** Unique identifier for the user */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** User's email address (unique, required) */
    @Column(nullable = false, unique = true)
    private String email;

    /** User's display name (from Supabase user_metadata.full_name) */
    @Column(name = "display_name")
    private String displayName;

    /** Supabase user UUID (unique, optional) */
    @Column(name = "supabase_user_id", unique = true)
    private String supabaseUserId;

    /** Supabase created timestamp (optional) */
    @Column(name = "supabase_created_at")
    private OffsetDateTime supabaseCreatedAt;

    /** When this record was last synced from Supabase */
    @Column(name = "supabase_synced_at")
    private OffsetDateTime supabaseSyncedAt;

    /** User's role in the system */
    @Column(name = "role")
    private String role;

    /** User's last login timestamp */
    @Column(name = "last_login")
    private LocalDateTime lastLogin;

    /** Timestamp when the user was created */
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}

