package com.prepaidly.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class BulkImportScheduleResponse {
    private boolean success;
    private int totalRequested;
    private int totalCreated;
    private int totalFailed;
    private List<ScheduleResponse> createdSchedules;
    private List<ImportError> errors;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ImportError {
        private int rowNumber;
        private String message;
    }
}
