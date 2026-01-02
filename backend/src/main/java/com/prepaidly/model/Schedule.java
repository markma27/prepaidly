package com.prepaidly.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Schedule entity representing an amortization schedule for prepaid expenses or unearned revenue.
 * Automatically generates monthly journal entries when created.
 */
@Entity
@Table(name = "schedules")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Schedule {
    /** Unique identifier for the schedule */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Xero tenant/organization ID this schedule belongs to */
    @Column(name = "tenant_id", nullable = false)
    private String tenantId;

    /** Optional Xero invoice ID linked to this schedule */
    @Column(name = "xero_invoice_id")
    private String xeroInvoiceId;

    /** Schedule type: PREPAID (expenses) or UNEARNED (revenue) */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ScheduleType type;

    /** Start date of the amortization period */
    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    /** End date of the amortization period */
    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    /** Total amount to be amortized across all periods */
    @Column(name = "total_amount", nullable = false, precision = 19, scale = 2)
    private BigDecimal totalAmount;

    /** Expense account code (required for PREPAID type) */
    @Column(name = "expense_acct_code")
    private String expenseAcctCode;

    /** Revenue account code (required for UNEARNED type) */
    @Column(name = "revenue_acct_code")
    private String revenueAcctCode;

    /** Deferral account code (prepaid expenses asset or unearned revenue liability) */
    @Column(name = "deferral_acct_code", nullable = false)
    private String deferralAcctCode;

    /** User ID who created this schedule */
    @Column(name = "created_by")
    private Long createdBy;

    /** Timestamp when the schedule was created */
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    /** Schedule type enumeration */
    public enum ScheduleType {
        /** Prepaid expense schedule (expenses paid upfront, recognized monthly) */
        PREPAID,
        /** Unearned revenue schedule (revenue received upfront, recognized monthly) */
        UNEARNED
    }
}

