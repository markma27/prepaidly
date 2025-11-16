package com.prepaidly.dto;

import com.prepaidly.model.Schedule;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class CreateScheduleRequest {
    @NotBlank(message = "Tenant ID is required")
    private String tenantId;
    
    private String xeroInvoiceId;
    
    @NotNull(message = "Schedule type is required")
    private Schedule.ScheduleType type;
    
    @NotNull(message = "Start date is required")
    private LocalDate startDate;
    
    @NotNull(message = "End date is required")
    private LocalDate endDate;
    
    @NotNull(message = "Total amount is required")
    @DecimalMin(value = "0.01", message = "Total amount must be greater than 0")
    private BigDecimal totalAmount;
    
    private String expenseAcctCode;
    
    private String revenueAcctCode;
    
    @NotBlank(message = "Deferral account code is required")
    private String deferralAcctCode;
    
    private Long createdBy;
}

