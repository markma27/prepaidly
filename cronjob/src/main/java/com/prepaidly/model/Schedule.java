package com.prepaidly.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Schedule entity representing an amortization schedule for prepaid expenses or unearned revenue.
 * Automatically generates monthly journal entries when created.
 * 
 * Note: This is a simplified version for the cronjob module (no JPA annotations).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Schedule {
    /** Unique identifier for the schedule */
    private Long id;

    /** Xero tenant/organization ID this schedule belongs to */
    private String tenantId;

    /** Optional Xero invoice ID linked to this schedule */
    private String xeroInvoiceId;

    /** Schedule type: PREPAID (expenses) or UNEARNED (revenue) */
    private ScheduleType type;

    /** Start date of the amortization period */
    private LocalDate startDate;

    /** End date of the amortization period */
    private LocalDate endDate;

    /** Total amount to be amortized across all periods */
    private BigDecimal totalAmount;

    /** Expense account code (required for PREPAID type) */
    private String expenseAcctCode;

    /** Revenue account code (required for UNEARNED type) */
    private String revenueAcctCode;

    /** Deferral account code (prepaid expenses asset or unearned revenue liability) */
    private String deferralAcctCode;

    /** User ID who created this schedule */
    private Long createdBy;

    /** Timestamp when the schedule was created */
    private LocalDateTime createdAt;

    /** Schedule type enumeration */
    public enum ScheduleType {
        /** Prepaid expense schedule (expenses paid upfront, recognized monthly) */
        PREPAID,
        /** Unearned revenue schedule (revenue received upfront, recognized monthly) */
        UNEARNED
    }
}

