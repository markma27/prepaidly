package com.prepaidly.service;

import com.prepaidly.dto.CreateScheduleRequest;
import com.prepaidly.dto.JournalEntryResponse;
import com.prepaidly.dto.ScheduleResponse;
import com.prepaidly.dto.VoidScheduleResponse;
import com.prepaidly.model.JournalEntry;
import com.prepaidly.model.Schedule;
import com.prepaidly.repository.JournalEntryRepository;
import com.prepaidly.repository.ScheduleRepository;
import com.prepaidly.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ScheduleService {
    
    private final ScheduleRepository scheduleRepository;
    private final JournalEntryRepository journalEntryRepository;
    private final UserRepository userRepository;
    private final XeroApiService xeroApiService;
    
    /**
     * Create a new schedule and generate journal entries
     */
    @Transactional
    public ScheduleResponse createSchedule(CreateScheduleRequest request) {
        // Validate dates
        if (request.getStartDate().isAfter(request.getEndDate())) {
            throw new IllegalArgumentException("Start date must be before end date");
        }
        
        // Create schedule
        Schedule schedule = new Schedule();
        schedule.setTenantId(request.getTenantId());
        schedule.setXeroInvoiceId(request.getXeroInvoiceId());
        schedule.setType(request.getType());
        schedule.setStartDate(request.getStartDate());
        schedule.setEndDate(request.getEndDate());
        schedule.setTotalAmount(request.getTotalAmount());
        schedule.setExpenseAcctCode(request.getExpenseAcctCode());
        schedule.setRevenueAcctCode(request.getRevenueAcctCode());
        schedule.setDeferralAcctCode(request.getDeferralAcctCode());
        schedule.setContactName(request.getContactName());
        schedule.setInvoiceReference(request.getInvoiceReference());
        schedule.setDescription(request.getDescription());
        schedule.setInvoiceDate(request.getInvoiceDate());
        schedule.setInvoiceUrl(request.getInvoiceUrl());
        schedule.setInvoiceFilename(request.getInvoiceFilename());
        schedule.setCreatedBy(request.getCreatedBy());
        
        schedule = scheduleRepository.save(schedule);
        
        // Generate journal entries (actual days or equal monthly)
        boolean useEqualMonthly = "equal".equalsIgnoreCase(request.getAllocationMethod());
        if (useEqualMonthly) {
            generateEqualMonthlyJournalEntries(schedule);
        } else {
            generateJournalEntries(schedule);
        }
        
        return toScheduleResponse(schedule);
    }
    
    /**
     * Generate journal entries for a schedule using daily pro-rata calculation.
     * 
     * Each period's amount is proportional to the number of days in that period
     * relative to the total number of days in the schedule. Posting dates are set
     * to the last day of each period (month-end or schedule end date).
     * 
     * Example: Start 6 Feb, End 5 Aug, Total $6,000 (181 days)
     *   Period 1: 6 Feb – 28 Feb (23 days) → $6,000 × 23/181 = $762.43, posted 28 Feb
     *   Period 2: 1 Mar – 31 Mar (31 days) → $6,000 × 31/181 = $1,027.62, posted 31 Mar
     *   ...
     *   Last period: 1 Aug – 5 Aug (5 days) → remainder, posted 5 Aug
     */
    private void generateJournalEntries(Schedule schedule) {
        LocalDate startDate = schedule.getStartDate();
        LocalDate endDate = schedule.getEndDate();
        
        if (!startDate.isBefore(endDate)) {
            throw new IllegalArgumentException("Start date must be before end date");
        }
        
        // Total days in the schedule (inclusive of both start and end)
        long totalDays = ChronoUnit.DAYS.between(startDate, endDate) + 1;
        
        if (totalDays <= 0) {
            throw new IllegalArgumentException("Schedule must span at least one day");
        }
        
        BigDecimal totalAmount = schedule.getTotalAmount();
        BigDecimal bdTotalDays = BigDecimal.valueOf(totalDays);
        BigDecimal remainingAmount = totalAmount;
        
        LocalDate periodStart = startDate;
        int periodNumber = 0;
        
        while (!periodStart.isAfter(endDate)) {
            periodNumber++;
            
            // Last day of current month
            LocalDate lastDayOfMonth = periodStart.withDayOfMonth(
                periodStart.lengthOfMonth()
            );
            
            // For day counting, cap at schedule end date
            LocalDate dayCountEnd = lastDayOfMonth.isBefore(endDate) ? lastDayOfMonth : endDate;
            
            // Days in this period (inclusive)
            long daysInPeriod = ChronoUnit.DAYS.between(periodStart, dayCountEnd) + 1;
            
            // Posting date is always the last day of the month
            LocalDate postingDate = lastDayOfMonth;
            
            // Calculate amount: last entry gets remainder to avoid rounding errors
            LocalDate nextPeriodStart = dayCountEnd.plusDays(1);
            boolean isLastPeriod = nextPeriodStart.isAfter(endDate);
            
            BigDecimal amount;
            if (isLastPeriod) {
                amount = remainingAmount;
            } else {
                amount = totalAmount
                    .multiply(BigDecimal.valueOf(daysInPeriod))
                    .divide(bdTotalDays, 2, RoundingMode.HALF_UP);
                remainingAmount = remainingAmount.subtract(amount);
            }
            
            JournalEntry entry = new JournalEntry();
            entry.setSchedule(schedule);
            // Posting date is always the last day of the month
            entry.setPeriodDate(postingDate);
            entry.setAmount(amount);
            entry.setPosted(false);
            
            journalEntryRepository.save(entry);
            
            // Move to first day of next month
            periodStart = nextPeriodStart;
        }
        
        if (periodNumber == 0) {
            throw new IllegalArgumentException("Schedule must generate at least one journal entry");
        }
    }
    
    /**
     * Generate journal entries using equal monthly amount.
     * - N = full months + 1 when both start and end are partial
     * - First period (if partial): pro-rate by (days in period / days in month) * base
     * - Full months: base = total / N
     * - Last period: balance (ensures exact total)
     */
    private void generateEqualMonthlyJournalEntries(Schedule schedule) {
        LocalDate startDate = schedule.getStartDate();
        LocalDate endDate = schedule.getEndDate();
        
        if (startDate.isAfter(endDate)) {
            throw new IllegalArgumentException("Start date must be before end date");
        }
        
        BigDecimal totalAmount = schedule.getTotalAmount();
        BigDecimal allocated = BigDecimal.ZERO;
        
        LocalDate periodStart = startDate;
        int periodNumber = 0;
        
        // First pass: build period structure
        java.util.List<PeriodInfo> periods = new java.util.ArrayList<>();
        LocalDate pStart = startDate;
        
        while (!pStart.isAfter(endDate)) {
            LocalDate lastDayOfMonth = pStart.withDayOfMonth(pStart.lengthOfMonth());
            LocalDate dayCountEnd = lastDayOfMonth.isBefore(endDate) ? lastDayOfMonth : endDate;
            long daysInPeriod = ChronoUnit.DAYS.between(pStart, dayCountEnd) + 1;
            int daysInMonth = pStart.lengthOfMonth();
            LocalDate nextStart = dayCountEnd.plusDays(1);
            boolean isLast = nextStart.isAfter(endDate);
            boolean isFirst = periods.isEmpty();
            boolean isFullMonth = daysInPeriod == daysInMonth;
            
            periods.add(new PeriodInfo(pStart, lastDayOfMonth, (int) daysInPeriod, daysInMonth, isFirst, isLast, isFullMonth));
            pStart = nextStart;
        }
        
        // N = full months + 1 when both partials
        long fullMonths = periods.stream().filter(p -> p.isFullMonth).count();
        boolean firstPartial = !periods.isEmpty() && periods.get(0).periodStart.getDayOfMonth() != 1;
        boolean lastPartial = !periods.isEmpty() && !periods.get(periods.size() - 1).isFullMonth;
        int N = (int) (fullMonths + (firstPartial && lastPartial ? 1 : 0));
        if (N < 1) N = 1;
        BigDecimal baseMonthlyAmount = totalAmount.divide(BigDecimal.valueOf(N), 2, RoundingMode.HALF_UP);
        
        for (PeriodInfo p : periods) {
            periodNumber++;
            BigDecimal amount;
            
            if (p.isLast) {
                amount = totalAmount.subtract(allocated).setScale(2, RoundingMode.HALF_UP);
            } else if (p.isFirst && firstPartial) {
                amount = baseMonthlyAmount
                    .multiply(BigDecimal.valueOf(p.daysInPeriod))
                    .divide(BigDecimal.valueOf(p.daysInMonth), 2, RoundingMode.HALF_UP);
            } else {
                amount = baseMonthlyAmount;
            }
            allocated = allocated.add(amount);
            
            JournalEntry entry = new JournalEntry();
            entry.setSchedule(schedule);
            entry.setPeriodDate(p.periodEnd);
            entry.setAmount(amount);
            entry.setPosted(false);
            journalEntryRepository.save(entry);
        }
        
        if (periodNumber == 0) {
            throw new IllegalArgumentException("Schedule must generate at least one journal entry");
        }
    }
    
    private record PeriodInfo(LocalDate periodStart, LocalDate periodEnd, int daysInPeriod, int daysInMonth,
                             boolean isFirst, boolean isLast, boolean isFullMonth) {}
    
    /**
     * Void a schedule. Voided schedules are excluded from Analytics and Register by default.
     */
    @Transactional
    public ScheduleResponse voidSchedule(Long scheduleId) {
        Schedule schedule = scheduleRepository.findById(scheduleId)
            .orElseThrow(() -> new RuntimeException("Schedule not found: " + scheduleId));
        schedule.setVoided(true);
        schedule = scheduleRepository.save(schedule);
        return toScheduleResponse(schedule);
    }
    
    /**
     * Void a schedule with Xero journal voiding.
     * 
     * This method:
     * 1. Checks all posted journals can be voided (period not locked)
     * 2. If any period is locked, returns error without voiding anything
     * 3. Voids all posted journals in Xero
     * 4. Marks the schedule as voided in our database
     * 
     * @param scheduleId The schedule to void
     * @param tenantId The Xero tenant ID for API calls
     * @return VoidScheduleResponse with details about the void operation
     */
    @Transactional
    public VoidScheduleResponse voidScheduleWithJournals(Long scheduleId, String tenantId) {
        Schedule schedule = scheduleRepository.findById(scheduleId)
            .orElseThrow(() -> new RuntimeException("Schedule not found: " + scheduleId));
        
        if (Boolean.TRUE.equals(schedule.getVoided())) {
            return new VoidScheduleResponse(
                true,
                "Schedule was already voided",
                toScheduleResponse(schedule),
                List.of(),
                List.of()
            );
        }
        
        // Get all journal entries for this schedule
        List<JournalEntry> entries = journalEntryRepository.findByScheduleId(scheduleId);
        
        // Filter to only posted entries with Xero journal IDs
        List<JournalEntry> postedEntries = entries.stream()
            .filter(e -> Boolean.TRUE.equals(e.getPosted()) && e.getXeroManualJournalId() != null)
            .collect(Collectors.toList());
        
        log.info("Voiding schedule {} with {} posted journals", scheduleId, postedEntries.size());
        
        // If no posted journals, just void the schedule
        if (postedEntries.isEmpty()) {
            schedule.setVoided(true);
            schedule = scheduleRepository.save(schedule);
            return new VoidScheduleResponse(
                true,
                "Schedule voided successfully (no posted journals to void in Xero)",
                toScheduleResponse(schedule),
                List.of(),
                List.of()
            );
        }
        
        // STEP 1: Check all journals can be voided first (Option C - all-or-nothing check)
        List<String> lockedPeriodJournals = new ArrayList<>();
        List<String> alreadyVoidedJournals = new ArrayList<>();
        List<String> notFoundJournals = new ArrayList<>();
        List<String> otherFailedJournals = new ArrayList<>();
        String firstCheckError = null;
        
        for (JournalEntry entry : postedEntries) {
            String journalId = entry.getXeroManualJournalId();
            try {
                XeroApiService.VoidJournalResult checkResult = 
                    xeroApiService.checkJournalCanBeVoided(tenantId, journalId);
                
                log.info("Check result for journal {}: success={}, status={}, error={}", 
                    journalId, checkResult.isSuccess(), checkResult.getStatus(), checkResult.getErrorMessage());
                
                if ("VOIDED".equalsIgnoreCase(checkResult.getStatus())) {
                    alreadyVoidedJournals.add(journalId);
                    log.info("Journal {} is already voided in Xero", journalId);
                } else if (checkResult.isSuccess()) {
                    // Journal is POSTED and can be voided - this is good
                    log.info("Journal {} is POSTED and can be voided", journalId);
                } else {
                    // Check failed - categorize the error
                    if (checkResult.isPeriodLocked()) {
                        lockedPeriodJournals.add(journalId);
                    } else if (checkResult.getErrorMessage() != null && 
                               checkResult.getErrorMessage().toLowerCase().contains("not found")) {
                        notFoundJournals.add(journalId);
                    } else {
                        // Any other check failure
                        otherFailedJournals.add(journalId);
                        if (firstCheckError == null) {
                            firstCheckError = checkResult.getErrorMessage();
                        }
                        log.error("Journal {} cannot be voided: {}", journalId, checkResult.getErrorMessage());
                    }
                }
            } catch (Exception e) {
                log.error("Error checking journal {} for void eligibility: {}", journalId, e.getMessage(), e);
                otherFailedJournals.add(journalId);
                if (firstCheckError == null) {
                    firstCheckError = "Error checking journal: " + e.getMessage();
                }
            }
        }
        
        // If any period is locked, fail the entire operation
        if (!lockedPeriodJournals.isEmpty()) {
            String lockedIds = String.join(", ", lockedPeriodJournals);
            log.warn("Cannot void schedule {}: {} journal(s) have locked periods in Xero: {}", 
                scheduleId, lockedPeriodJournals.size(), lockedIds);
            return new VoidScheduleResponse(
                false,
                "Cannot void: The Xero accounting period is locked for " + lockedPeriodJournals.size() + 
                    " journal(s). Please unlock the period in Xero first.",
                null,
                List.of(),
                lockedPeriodJournals
            );
        }
        
        // If any journal check failed for other reasons, fail the entire operation
        if (!otherFailedJournals.isEmpty()) {
            log.warn("Cannot void schedule {}: {} journal(s) cannot be voided: {}", 
                scheduleId, otherFailedJournals.size(), firstCheckError);
            return new VoidScheduleResponse(
                false,
                "Cannot void: " + (firstCheckError != null ? firstCheckError : "One or more journals cannot be voided in Xero."),
                null,
                List.of(),
                otherFailedJournals
            );
        }
        
        // STEP 2: Void all journals in Xero
        List<String> voidedJournalIds = new ArrayList<>();
        List<String> failedJournalIds = new ArrayList<>();
        String firstError = null;
        
        for (JournalEntry entry : postedEntries) {
            String journalId = entry.getXeroManualJournalId();
            
            // Skip already voided journals - these are OK to proceed
            if (alreadyVoidedJournals.contains(journalId)) {
                voidedJournalIds.add(journalId);
                log.info("Skipping already voided journal: {}", journalId);
                continue;
            }
            
            // Journals not found in Xero - show warning and let user decide
            // (This is different from "failed to void" - the journal doesn't exist anymore)
            if (notFoundJournals.contains(journalId)) {
                log.warn("Journal {} not found in Xero - may have been deleted externally", journalId);
                // Don't add to failedJournalIds - treat as "handled" since it doesn't exist
                voidedJournalIds.add(journalId);
                continue;
            }
            
            try {
                XeroApiService.VoidJournalResult result = 
                    xeroApiService.voidManualJournal(tenantId, journalId);
                
                if (result.isSuccess()) {
                    voidedJournalIds.add(journalId);
                    log.info("Successfully voided journal {} in Xero", journalId);
                } else {
                    // ANY failure to void a journal should stop the entire operation
                    failedJournalIds.add(journalId);
                    if (firstError == null) {
                        firstError = result.getErrorMessage();
                    }
                    log.error("Failed to void journal {}: {}", journalId, result.getErrorMessage());
                    
                    // Determine the appropriate error message
                    String errorMessage;
                    if (result.isPeriodLocked()) {
                        errorMessage = "Cannot void: The Xero accounting period is locked. Please unlock the period in Xero first.";
                    } else {
                        errorMessage = "Cannot void: Failed to void journal in Xero. " + 
                            (result.getErrorMessage() != null ? result.getErrorMessage() : "Unknown error");
                    }
                    
                    return new VoidScheduleResponse(
                        false,
                        errorMessage,
                        null,
                        voidedJournalIds,
                        failedJournalIds
                    );
                }
            } catch (Exception e) {
                failedJournalIds.add(journalId);
                if (firstError == null) {
                    firstError = e.getMessage();
                }
                log.error("Exception voiding journal {}: {}", journalId, e.getMessage(), e);
                
                // Exception also stops the entire operation
                return new VoidScheduleResponse(
                    false,
                    "Cannot void: Error voiding journal in Xero. " + e.getMessage(),
                    null,
                    voidedJournalIds,
                    failedJournalIds
                );
            }
        }
        
        // STEP 3: Only mark schedule as voided if ALL journals were successfully voided
        // (We only reach here if no failures occurred above)
        schedule.setVoided(true);
        schedule = scheduleRepository.save(schedule);
        
        // Build success message
        String message = "Schedule voided successfully. " + voidedJournalIds.size() + " journal(s) voided in Xero.";
        if (!alreadyVoidedJournals.isEmpty()) {
            message += " (" + alreadyVoidedJournals.size() + " were already voided)";
        }
        if (!notFoundJournals.isEmpty()) {
            message += " Note: " + notFoundJournals.size() + " journal(s) were not found in Xero (may have been deleted externally).";
        }
        
        log.info("Void operation complete for schedule {}: {}", scheduleId, message);
        
        return new VoidScheduleResponse(
            true,
            message,
            toScheduleResponse(schedule),
            voidedJournalIds,
            List.of()  // No failed journals if we reach here
        );
    }

    /**
     * Get all schedules for a tenant
     * Note: Using PROPAGATION_SUPPORTS to avoid transaction issues with connection poolers
     * @param includeVoided when true, includes voided schedules; when false, excludes them (default for Register/Analytics)
     */
    @Transactional(propagation = Propagation.SUPPORTS, readOnly = true)
    public List<ScheduleResponse> getSchedulesByTenant(String tenantId, boolean includeVoided) {
        try {
            List<Schedule> schedules = scheduleRepository.findByTenantId(tenantId);
            if (!includeVoided) {
                schedules = schedules.stream()
                    .filter(s -> s.getVoided() == null || !s.getVoided())
                    .collect(Collectors.toList());
            }
            return schedules.stream()
                .map(schedule -> {
                    try {
                        return toScheduleResponse(schedule);
                    } catch (Exception e) {
                        // Check if this is a transaction abort, rollback, or commit error
                        String errorMessage = e.getMessage() != null ? e.getMessage().toLowerCase() : "";
                        boolean isTransactionError = errorMessage.contains("current transaction is aborted") ||
                                                    errorMessage.contains("commands ignored until end of transaction") ||
                                                    errorMessage.contains("unable to rollback") ||
                                                    errorMessage.contains("unable to commit");
                        
                        if (isTransactionError) {
                            log.error("Transaction error when converting schedule {} to response: {}", 
                                schedule.getId(), e.getMessage(), e);
                        } else {
                            log.error("Error converting schedule {} to response: {}", 
                                schedule.getId(), e.getMessage(), e);
                        }
                        // Return a minimal response without journal entries if conversion fails
                        return createMinimalScheduleResponse(schedule);
                    }
                })
                .collect(Collectors.toList());
        } catch (Exception e) {
            // Check if this is a transaction abort, rollback, or commit error
            String errorMessage = e.getMessage() != null ? e.getMessage().toLowerCase() : "";
            boolean isTransactionError = errorMessage.contains("current transaction is aborted") ||
                                        errorMessage.contains("commands ignored until end of transaction") ||
                                        errorMessage.contains("unable to rollback") ||
                                        errorMessage.contains("unable to commit");
            
            if (isTransactionError) {
                log.error("Transaction error when fetching schedules for tenant {}: {}", 
                    tenantId, e.getMessage(), e);
            } else {
                log.error("Error fetching schedules for tenant {}: {}", tenantId, e.getMessage(), e);
            }
            // Re-throw to propagate error to controller
            throw e;
        }
    }
    
    /**
     * Get schedule by ID
     * Note: Using PROPAGATION_SUPPORTS to avoid transaction issues with connection poolers
     */
    /**
     * Get distinct contact names for a tenant (for autocomplete)
     */
    @Transactional(propagation = Propagation.SUPPORTS, readOnly = true)
    public List<String> getDistinctContactNames(String tenantId) {
        return scheduleRepository.findDistinctContactNamesByTenantId(tenantId);
    }

    @Transactional(propagation = Propagation.SUPPORTS, readOnly = true)
    public ScheduleResponse getScheduleById(Long scheduleId) {
        Schedule schedule = Objects.requireNonNull(
            scheduleRepository.findById(Objects.requireNonNull(scheduleId, "Schedule ID cannot be null"))
                .orElseThrow(() -> new RuntimeException("Schedule not found: " + scheduleId)),
            "Schedule cannot be null"
        );
        return toScheduleResponse(schedule);
    }
    
    /**
     * Convert Schedule entity to ScheduleResponse DTO
     */
    private ScheduleResponse toScheduleResponse(Schedule schedule) {
        ScheduleResponse response = new ScheduleResponse();
        response.setId(schedule.getId());
        response.setTenantId(schedule.getTenantId());
        response.setXeroInvoiceId(schedule.getXeroInvoiceId());
        response.setType(schedule.getType());
        response.setStartDate(schedule.getStartDate());
        response.setEndDate(schedule.getEndDate());
        response.setTotalAmount(schedule.getTotalAmount());
        response.setExpenseAcctCode(schedule.getExpenseAcctCode());
        response.setRevenueAcctCode(schedule.getRevenueAcctCode());
        response.setDeferralAcctCode(schedule.getDeferralAcctCode());
        response.setContactName(schedule.getContactName());
        response.setInvoiceReference(schedule.getInvoiceReference());
        response.setDescription(schedule.getDescription());
        response.setInvoiceDate(schedule.getInvoiceDate());
        response.setInvoiceUrl(schedule.getInvoiceUrl());
        response.setInvoiceFilename(schedule.getInvoiceFilename());
        response.setCreatedBy(schedule.getCreatedBy());
        response.setCreatedAt(schedule.getCreatedAt());
        response.setVoided(Boolean.TRUE.equals(schedule.getVoided()));
        
        // Look up creator's name from user repository
        if (schedule.getCreatedBy() != null) {
            try {
                userRepository.findById(schedule.getCreatedBy())
                    .ifPresent(user -> {
                        // Extract name from email (e.g., "john.doe@example.com" -> "john.doe")
                        String name = user.getEmail() != null && user.getEmail().contains("@")
                            ? user.getEmail().split("@")[0]
                            : "User";
                        response.setCreatedByName(name);
                    });
            } catch (Exception e) {
                log.warn("Failed to look up creator name for schedule {}: {}", schedule.getId(), e.getMessage());
                // Continue without creator name if lookup fails
            }
        }
        
        // Get journal entries with error handling to prevent transaction abort
        try {
            List<JournalEntry> entries = journalEntryRepository.findByScheduleId(schedule.getId());
            List<JournalEntryResponse> entryResponses = entries.stream()
                .map(this::toJournalEntryResponse)
                .collect(Collectors.toList());
            response.setJournalEntries(entryResponses);
            
            // Calculate statistics
            response.setTotalPeriods(entries.size());
            response.setPostedPeriods((int) entries.stream()
                .filter(JournalEntry::getPosted)
                .count());
            
            // Calculate remaining balance
            BigDecimal postedAmount = entries.stream()
                .filter(JournalEntry::getPosted)
                .map(JournalEntry::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
            response.setRemainingBalance(schedule.getTotalAmount().subtract(postedAmount));
        } catch (Exception e) {
            // Check if this is a transaction abort, rollback, or commit error
            String errorMessage = e.getMessage() != null ? e.getMessage().toLowerCase() : "";
            boolean isTransactionError = errorMessage.contains("current transaction is aborted") ||
                                        errorMessage.contains("commands ignored until end of transaction") ||
                                        errorMessage.contains("unable to rollback") ||
                                        errorMessage.contains("unable to commit");
            
            if (isTransactionError) {
                log.error("Transaction error when fetching journal entries for schedule {}: {}", 
                    schedule.getId(), e.getMessage(), e);
            } else {
                log.error("Error fetching journal entries for schedule {}: {}", 
                    schedule.getId(), e.getMessage(), e);
            }
            
            // Set empty journal entries and default statistics if query fails
            // Don't re-throw to prevent transaction abort - return partial data instead
            response.setJournalEntries(List.of());
            response.setTotalPeriods(0);
            response.setPostedPeriods(0);
            response.setRemainingBalance(schedule.getTotalAmount());
        }
        
        return response;
    }
    
    /**
     * Create a minimal ScheduleResponse without journal entries (used as fallback on error)
     */
    private ScheduleResponse createMinimalScheduleResponse(Schedule schedule) {
        ScheduleResponse response = new ScheduleResponse();
        response.setId(schedule.getId());
        response.setTenantId(schedule.getTenantId());
        response.setXeroInvoiceId(schedule.getXeroInvoiceId());
        response.setType(schedule.getType());
        response.setStartDate(schedule.getStartDate());
        response.setEndDate(schedule.getEndDate());
        response.setTotalAmount(schedule.getTotalAmount());
        response.setExpenseAcctCode(schedule.getExpenseAcctCode());
        response.setRevenueAcctCode(schedule.getRevenueAcctCode());
        response.setDeferralAcctCode(schedule.getDeferralAcctCode());
        response.setContactName(schedule.getContactName());
        response.setInvoiceReference(schedule.getInvoiceReference());
        response.setDescription(schedule.getDescription());
        response.setInvoiceDate(schedule.getInvoiceDate());
        response.setInvoiceUrl(schedule.getInvoiceUrl());
        response.setInvoiceFilename(schedule.getInvoiceFilename());
        response.setCreatedBy(schedule.getCreatedBy());
        response.setCreatedAt(schedule.getCreatedAt());
        response.setVoided(Boolean.TRUE.equals(schedule.getVoided()));
        response.setJournalEntries(List.of());
        response.setTotalPeriods(0);
        response.setPostedPeriods(0);
        response.setRemainingBalance(schedule.getTotalAmount());
        return response;
    }
    
    /**
     * Convert JournalEntry entity to JournalEntryResponse DTO
     */
    private JournalEntryResponse toJournalEntryResponse(JournalEntry entry) {
        JournalEntryResponse response = new JournalEntryResponse();
        response.setId(entry.getId());
        response.setScheduleId(entry.getSchedule().getId());
        response.setPeriodDate(entry.getPeriodDate());
        response.setAmount(entry.getAmount());
        response.setXeroManualJournalId(entry.getXeroManualJournalId());
        response.setXeroJournalNumber(entry.getXeroJournalNumber());
        response.setPosted(entry.getPosted());
        response.setCreatedAt(entry.getCreatedAt());
        response.setPostedAt(entry.getPostedAt());
        response.setUpdatedAt(entry.getUpdatedAt());
        return response;
    }
}

