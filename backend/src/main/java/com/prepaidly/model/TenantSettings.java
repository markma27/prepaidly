package com.prepaidly.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;

/**
 * Stores per-tenant settings such as default account codes.
 * One row per tenant.
 */
@Entity
@Table(name = "tenant_settings")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TenantSettings {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id", nullable = false, unique = true)
    private String tenantId;

    /** Default prepayment asset account code */
    @Column(name = "default_prepayment_acct_code")
    private String defaultPrepaymentAcctCode;

    /** Default unearned revenue liability account code */
    @Column(name = "default_unearned_acct_code")
    private String defaultUnearnedAcctCode;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
