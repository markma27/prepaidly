package com.prepaidly.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class JournalEntryResponse {
    private Long id;
    private Long scheduleId;
    private LocalDate periodDate;
    private BigDecimal amount;
    private String xeroManualJournalId;
    private Boolean posted;
    private LocalDateTime createdAt;
}

