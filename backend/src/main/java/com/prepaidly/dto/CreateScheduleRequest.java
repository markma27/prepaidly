package com.prepaidly.dto;

import com.prepaidly.model.Schedule;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Create Schedule Request DTO
 * 
 * Data Transfer Object for creating a new amortization schedule. Used as the request
 * body for the schedule creation endpoint.
 * 
 * A schedule represents a plan to recognize prepayment or unearned revenue
 * over a period of time (typically monthly). When a schedule is created, the system
 * automatically generates monthly journal entries that can later be posted to Xero.
 * 
 * Required fields depend on the schedule type:
 * - PREPAID: Requires expenseAcctCode and deferralAcctCode
 * - UNEARNED: Requires revenueAcctCode and deferralAcctCode
 * 
 * The total amount is evenly distributed across all months in the date range.
 * 
 * @see ScheduleResponse for the response DTO
 * @see com.prepaidly.controller.ScheduleController#createSchedule(CreateScheduleRequest)
 * @see com.prepaidly.model.Schedule.ScheduleType for schedule type options
 */
@Data
public class CreateScheduleRequest {
    /**
     * Xero tenant/organization ID
     * 
     * Identifies which Xero organization this schedule belongs to. Must match a
     * connected Xero organization for the user.
     * 
     * Required: Yes
     * Example: "tenant-abc-123"
     */
    @NotBlank(message = "Tenant ID is required")
    private String tenantId;
    
    /**
     * Optional Xero invoice ID
     * 
     * Links this schedule to a specific Xero invoice or bill. If provided, the
     * schedule is associated with that invoice for reference purposes.
     * 
     * Required: No
     * Example: "invoice-xyz-789"
     */
    private String xeroInvoiceId;
    
    /**
     * Schedule type
     * 
     * Determines whether this is a prepayment or unearned revenue schedule.
     * 
     * - PREPAID: For prepayment (e.g., insurance paid upfront, recognized monthly)
     * - UNEARNED: For unearned revenue (e.g., subscription revenue received upfront, recognized monthly)
     * 
     * Required: Yes
     * 
     * @see com.prepaidly.model.Schedule.ScheduleType
     */
    @NotNull(message = "Schedule type is required")
    private Schedule.ScheduleType type;
    
    /**
     * Start date of the schedule
     * 
     * The first date of the amortization period. Journal entries will be generated
     * starting from this date (first day of the month).
     * 
     * Required: Yes
     * Must be before endDate
     * Example: "2025-01-01"
     */
    @NotNull(message = "Start date is required")
    private LocalDate startDate;
    
    /**
     * End date of the schedule
     * 
     * The last date of the amortization period. Journal entries will be generated
     * up to and including this date.
     * 
     * Required: Yes
     * Must be after startDate
     * Schedule must span at least one month
     * Example: "2025-03-31"
     */
    @NotNull(message = "End date is required")
    private LocalDate endDate;
    
    /**
     * Total amount to be amortized
     * 
     * The total amount that will be distributed evenly across all months in the
     * schedule period. The system automatically calculates the monthly amount and
     * handles rounding to ensure the total matches exactly.
     * 
     * Required: Yes
     * Must be greater than 0.01
     * Example: 3000.00
     */
    @NotNull(message = "Total amount is required")
    @DecimalMin(value = "0.01", message = "Total amount must be greater than 0")
    private BigDecimal totalAmount;
    
    /**
     * Expense account code (for PREPAID schedules)
     * 
     * The Chart of Accounts code for the expense account. This is where the expense
     * will be recognized each month. Required only for PREPAID type schedules.
     * 
     * Required: Yes (for PREPAID), No (for UNEARNED)
     * Example: "6000" (Office Expenses)
     */
    private String expenseAcctCode;
    
    /**
     * Revenue account code (for UNEARNED schedules)
     * 
     * The Chart of Accounts code for the revenue account. This is where the revenue
     * will be recognized each month. Required only for UNEARNED type schedules.
     * 
     * Required: Yes (for UNEARNED), No (for PREPAID)
     * Example: "4000" (Subscription Revenue)
     */
    private String revenueAcctCode;
    
    /**
     * Deferral account code
     * 
     * The Chart of Accounts code for the deferral account (prepayment asset
     * account or unearned revenue liability account). This account holds the deferred
     * amount until it's recognized.
     * 
     * Required: Yes (for both PREPAID and UNEARNED)
     * Example: "2000" (Prepaid Expenses) or "2500" (Unearned Revenue)
     */
    @NotBlank(message = "Deferral account code is required")
    private String deferralAcctCode;
    
    /**
     * User ID who created the schedule
     * 
     * Optional identifier for the user who created this schedule. Used for audit
     * and tracking purposes.
     * 
     * Required: No
     * Example: 1
     */
    private Long createdBy;
}

