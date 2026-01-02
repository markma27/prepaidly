package com.prepaidly.controller;

import com.prepaidly.dto.CreateScheduleRequest;
import com.prepaidly.dto.ScheduleResponse;
import com.prepaidly.service.ScheduleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Schedule Controller
 * 
 * REST controller for managing amortization schedules. A schedule represents a plan
 * to recognize prepaid expenses or unearned revenue over a period of time (typically
 * monthly). Schedules are used to automate the accounting process of spreading costs
 * or revenue across multiple accounting periods.
 * 
 * When a schedule is created, the system automatically generates monthly journal entries
 * that can later be posted to Xero. Each schedule can be one of two types:
 * - PREPAID: For prepaid expenses (e.g., insurance paid upfront, recognized monthly)
 * - UNEARNED: For unearned revenue (e.g., subscription revenue received upfront, recognized monthly)
 * 
 * The controller provides endpoints to:
 * - Create new schedules with automatic journal entry generation
 * - Retrieve schedules by tenant (organization)
 * - Retrieve individual schedules by ID
 * 
 * All schedules are tenant-scoped, ensuring multi-tenant data isolation.
 */
@Slf4j
@RestController
@RequestMapping("/api/schedules")
@RequiredArgsConstructor
public class ScheduleController {

    private final ScheduleService scheduleService;

    /**
     * Create a New Schedule
     * 
     * Creates a new amortization schedule and automatically generates monthly journal
     * entries for the specified date range. The total amount is evenly distributed
     * across all months in the schedule period.
     * 
     * The schedule defines:
     * - The type (prepaid expense or unearned revenue)
     * - The date range (start and end dates)
     * - The total amount to be amortized
     * - The account codes for expense/revenue and deferral accounts
     * 
     * Upon creation, the system calculates the number of months between start and end
     * dates and creates one journal entry per month. Each journal entry can later be
     * posted to Xero individually.
     * 
     * @param request CreateScheduleRequest containing:
     *                - tenantId: The tenant/organization ID (required)
     *                - type: Schedule type - PREPAID or UNEARNED (required)
     *                - startDate: Start date of the schedule (required)
     *                - endDate: End date of the schedule (required, must be after startDate)
     *                - totalAmount: Total amount to amortize (required, must be > 0)
     *                - expenseAcctCode: Expense account code (required for PREPAID type)
     *                - revenueAcctCode: Revenue account code (required for UNEARNED type)
     *                - deferralAcctCode: Deferral account code (required)
     *                - xeroInvoiceId: Optional Xero invoice ID if linked to an invoice
     *                - createdBy: Optional user ID who created the schedule
     * 
     * @return ResponseEntity with ScheduleResponse or error:
     *         - Success (200 OK): Returns ScheduleResponse containing:
     *           - Schedule details (id, tenantId, type, dates, amounts, account codes)
     *           - Generated journal entries with period dates and amounts
     *           - Statistics (total periods, posted periods, remaining balance)
     *         - Bad Request (400): Returns error message if validation fails
     *         - Internal Server Error (500): Returns error message if creation fails
     * 
     * @apiNote POST /api/schedules
     * 
     * @throws IllegalArgumentException if:
     *         - Start date is after end date
     *         - Schedule does not span at least one month
     *         - Required fields are missing or invalid
     * 
     * @example Request (Prepaid Expense):
     * {
     *   "tenantId": "tenant-abc-123",
     *   "type": "PREPAID",
     *   "startDate": "2025-01-01",
     *   "endDate": "2025-03-31",
     *   "totalAmount": 3000.00,
     *   "expenseAcctCode": "6000",
     *   "deferralAcctCode": "2000",
     *   "createdBy": 1
     * }
     * 
     * @example Request (Unearned Revenue):
     * {
     *   "tenantId": "tenant-abc-123",
     *   "type": "UNEARNED",
     *   "startDate": "2025-01-01",
     *   "endDate": "2025-12-31",
     *   "totalAmount": 12000.00,
     *   "revenueAcctCode": "4000",
     *   "deferralAcctCode": "2500",
     *   "createdBy": 1
     * }
     * 
     * @usage After creating a schedule, use JournalController to post individual
     *        journal entries to Xero when each period arrives.
     */
    @PostMapping
    public ResponseEntity<?> createSchedule(@Valid @RequestBody CreateScheduleRequest request) {
        try {
            ScheduleResponse schedule = scheduleService.createSchedule(request);
            return ResponseEntity.ok(schedule);
        } catch (IllegalArgumentException e) {
            log.error("Invalid schedule request", e);
            return ResponseEntity.badRequest().body(Map.of(
                "error", e.getMessage()
            ));
        } catch (Exception e) {
            log.error("Error creating schedule", e);
            return ResponseEntity.status(500).body(Map.of(
                "error", "Failed to create schedule: " + e.getMessage()
            ));
        }
    }

    /**
     * Get All Schedules for a Tenant
     * 
     * Retrieves all amortization schedules belonging to a specific tenant/organization.
     * Returns a list of schedules with their associated journal entries and statistics.
     * 
     * This endpoint is useful for:
     * - Displaying all schedules in a dashboard
     * - Viewing schedule status and progress
     * - Filtering and managing multiple schedules
     * 
     * @param tenantId The tenant/organization ID to filter schedules (required)
     * 
     * @return ResponseEntity with list of schedules or error:
     *         - Success (200 OK): Returns JSON with:
     *           {
     *             "schedules": [<ScheduleResponse>, ...],
     *             "count": <number-of-schedules>
     *           }
     *         - Internal Server Error (500): Returns error message if fetch fails
     * 
     * @apiNote GET /api/schedules?tenantId={tenantId}
     * 
     * @example Request:
     * GET /api/schedules?tenantId=tenant-abc-123
     * 
     * @example Success Response:
     * {
     *   "schedules": [
     *     {
     *       "id": 1,
     *       "tenantId": "tenant-abc-123",
     *       "type": "PREPAID",
     *       "startDate": "2025-01-01",
     *       "endDate": "2025-03-31",
     *       "totalAmount": 3000.00,
     *       "journalEntries": [...],
     *       "totalPeriods": 3,
     *       "postedPeriods": 1,
     *       "remainingBalance": 2000.00
     *     }
     *   ],
     *   "count": 1
     * }
     * 
     * @usage Use this endpoint to retrieve all schedules for display in a dashboard
     *        or list view. Each schedule includes its journal entries and posting status.
     */
    @GetMapping
    public ResponseEntity<?> getSchedules(@RequestParam String tenantId) {
        try {
            List<ScheduleResponse> schedules = scheduleService.getSchedulesByTenant(tenantId);
            return ResponseEntity.ok(Map.of(
                "schedules", schedules,
                "count", schedules.size()
            ));
        } catch (Exception e) {
            log.error("Error fetching schedules", e);
            return ResponseEntity.status(500).body(Map.of(
                "error", "Failed to fetch schedules: " + e.getMessage()
            ));
        }
    }
    
    /**
     * Get Schedule by ID
     * 
     * Retrieves a specific amortization schedule by its ID. Returns the complete
     * schedule details including all associated journal entries, posting status,
     * and calculated statistics (total periods, posted periods, remaining balance).
     * 
     * This endpoint is useful for:
     * - Viewing detailed information about a specific schedule
     * - Checking which journal entries have been posted
     * - Reviewing schedule configuration and amounts
     * 
     * @param id The unique identifier of the schedule (required)
     * 
     * @return ResponseEntity with ScheduleResponse or error:
     *         - Success (200 OK): Returns ScheduleResponse containing:
     *           - Complete schedule details
     *           - All journal entries with posting status
     *           - Statistics (periods, balance)
     *         - Internal Server Error (500): Returns error message if:
     *           - Schedule not found
     *           - Database error occurs
     * 
     * @apiNote GET /api/schedules/{id}
     * 
     * @example Request:
     * GET /api/schedules/123
     * 
     * @example Success Response:
     * {
     *   "id": 123,
     *   "tenantId": "tenant-abc-123",
     *   "type": "PREPAID",
     *   "startDate": "2025-01-01",
     *   "endDate": "2025-03-31",
     *   "totalAmount": 3000.00,
     *   "expenseAcctCode": "6000",
     *   "deferralAcctCode": "2000",
     *   "journalEntries": [
     *     {
     *       "id": 1,
     *       "periodDate": "2025-01-01",
     *       "amount": 1000.00,
     *       "posted": true,
     *       "xeroManualJournalId": "xero-journal-123"
     *     },
     *     ...
     *   ],
     *   "totalPeriods": 3,
     *   "postedPeriods": 1,
     *   "remainingBalance": 2000.00
     * }
     * 
     * @usage Use this endpoint to view detailed information about a specific schedule
     *        and its journal entries. The response includes posting status for each
     *        journal entry, allowing you to see which periods have been recognized.
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getSchedule(@PathVariable Long id) {
        try {
            ScheduleResponse schedule = scheduleService.getScheduleById(id);
            return ResponseEntity.ok(schedule);
        } catch (Exception e) {
            log.error("Error fetching schedule {}", id, e);
            return ResponseEntity.status(500).body(Map.of(
                "error", "Failed to fetch schedule: " + e.getMessage()
            ));
        }
    }
}

