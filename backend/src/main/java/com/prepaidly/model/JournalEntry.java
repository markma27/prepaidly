package com.prepaidly.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Journal entry entity representing one month's recognition amount in a schedule.
 * Automatically generated when a schedule is created.
 */
@Entity
@Table(name = "journal_entries")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class JournalEntry {
    /** Unique identifier for the journal entry */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** The schedule this journal entry belongs to */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "schedule_id", nullable = false)
    private Schedule schedule;

    /** Period date (first day of the month) for this entry */
    @Column(name = "period_date", nullable = false)
    private LocalDate periodDate;

    /** Amount to be recognized for this period */
    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal amount;

    /** Xero manual journal ID (set when posted to Xero) */
    @Column(name = "xero_manual_journal_id")
    private String xeroManualJournalId;

    /** Whether this entry has been posted to Xero */
    @Column(nullable = false)
    private Boolean posted = false;

    /** Timestamp when the journal entry was created */
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (posted == null) {
            posted = false;
        }
    }
}

