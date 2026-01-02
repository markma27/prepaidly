package com.prepaidly.cronjob.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Journal entry model for cron job.
 * Represents a journal entry from the journal_entries table.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class JournalEntry {
    /** Unique identifier for the journal entry */
    private Long id;
    
    /** Schedule ID this journal entry belongs to */
    private Long scheduleId;
    
    /** Period date (first day of the month) for this entry */
    private LocalDate periodDate;
    
    /** Amount to be recognized for this period */
    private BigDecimal amount;
    
    /** Xero manual journal ID (set when posted to Xero) */
    private String xeroManualJournalId;
    
    /** Whether this entry has been posted to Xero */
    private Boolean posted;
    
    /** Timestamp when the journal entry was created */
    private LocalDateTime createdAt;
}

