package com.prepaidly.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class PostJournalRequest {
    @NotNull(message = "Journal entry ID is required")
    private Long journalEntryId;
    
    @NotNull(message = "Tenant ID is required")
    private String tenantId;
}

