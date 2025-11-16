package com.prepaidly.dto;

import com.prepaidly.model.Schedule;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class ScheduleResponse {
    private Long id;
    private String tenantId;
    private String xeroInvoiceId;
    private Schedule.ScheduleType type;
    private LocalDate startDate;
    private LocalDate endDate;
    private BigDecimal totalAmount;
    private String expenseAcctCode;
    private String revenueAcctCode;
    private String deferralAcctCode;
    private Long createdBy;
    private LocalDateTime createdAt;
    private List<JournalEntryResponse> journalEntries;
    private BigDecimal remainingBalance;
    private Integer totalPeriods;
    private Integer postedPeriods;
}

