package com.prepaidly.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Response DTO for voiding a schedule with Xero journals.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class VoidScheduleResponse {
    private boolean success;
    private String message;
    private ScheduleResponse schedule;
    private List<String> voidedJournalIds;
    private List<String> failedJournalIds;
}
