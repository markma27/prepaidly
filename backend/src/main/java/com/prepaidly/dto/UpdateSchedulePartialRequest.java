package com.prepaidly.dto;

import lombok.Data;

/**
 * Request DTO for partial schedule update (contact, invoice reference, description only).
 * Used when at least one journal entry has been posted; only these fields can be edited.
 */
@Data
public class UpdateSchedulePartialRequest {
    private String contactName;
    private String invoiceReference;
    private String description;
}
