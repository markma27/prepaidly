package com.prepaidly.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Journal entry entity representing one month's recognition amount in a schedule.
 * Automatically generated when a schedule is created.
 * 
 * Note: This is a simplified version for the cronjob module (no JPA relationships).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class JournalEntry {
    /** Unique identifier for the journal entry */
    private Long id;

    /** Schedule ID this journal entry belongs to (not loaded as relationship) */
    private Long scheduleId;

    /** Period date (first day of the month) for this entry */
    private LocalDate periodDate;

    /** Amount to be recognized for this period */
    private BigDecimal amount;

    /** Xero manual journal ID (set when posted to Xero) */
    private String xeroManualJournalId;

    /** Whether this entry has been posted to Xero */
    private Boolean posted = false;

    /** Timestamp when the journal entry was created */
    private LocalDateTime createdAt;
}

