package com.prepaidly.dto;

import lombok.Data;

import java.util.List;

@Data
public class BulkImportScheduleRequest {
    private String tenantId;
    private List<CreateScheduleRequest> schedules;
}
