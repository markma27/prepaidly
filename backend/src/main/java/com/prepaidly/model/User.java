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

    /** Supabase user UUID (unique, optional) */
    @Column(name = "supabase_user_id", unique = true)
    private String supabaseUserId;

    /** Supabase phone number (optional) */
    @Column(name = "supabase_phone")
    private String supabasePhone;

    /** Supabase created timestamp (optional) */
    @Column(name = "supabase_created_at")
    private OffsetDateTime supabaseCreatedAt;

    /** Supabase updated timestamp (optional) */
    @Column(name = "supabase_updated_at")
    private OffsetDateTime supabaseUpdatedAt;

    /** Supabase last sign-in timestamp (optional) */
    @Column(name = "supabase_last_sign_in_at")
    private OffsetDateTime supabaseLastSignInAt;

    /** Supabase email confirmed timestamp (optional) */
    @Column(name = "supabase_email_confirmed_at")
    private OffsetDateTime supabaseEmailConfirmedAt;

    /** Supabase phone confirmed timestamp (optional) */
    @Column(name = "supabase_phone_confirmed_at")
    private OffsetDateTime supabasePhoneConfirmedAt;

    /** Full Supabase user payload for complete sync */
    @Column(name = "supabase_raw_json", columnDefinition = "TEXT")
    private String supabaseRawJson;

    /** When this record was last synced from Supabase */
    @Column(name = "supabase_synced_at")
    private OffsetDateTime supabaseSyncedAt;

    /** Timestamp when the user was created */
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}

