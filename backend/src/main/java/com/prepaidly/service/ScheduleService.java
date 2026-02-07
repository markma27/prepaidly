package com.prepaidly.service;

import com.prepaidly.dto.CreateScheduleRequest;
import com.prepaidly.dto.JournalEntryResponse;
import com.prepaidly.dto.ScheduleResponse;
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
        schedule.setDescription(request.getDescription());
        schedule.setInvoiceDate(request.getInvoiceDate());
        schedule.setInvoiceUrl(request.getInvoiceUrl());
        schedule.setInvoiceFilename(request.getInvoiceFilename());
        schedule.setCreatedBy(request.getCreatedBy());
        
        schedule = scheduleRepository.save(schedule);
        
        // Generate journal entries
        generateJournalEntries(schedule);
        
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
     * Get all schedules for a tenant
     * Note: Using PROPAGATION_SUPPORTS to avoid transaction issues with connection poolers
     */
    @Transactional(propagation = Propagation.SUPPORTS, readOnly = true)
    public List<ScheduleResponse> getSchedulesByTenant(String tenantId) {
        try {
            List<Schedule> schedules = scheduleRepository.findByTenantId(tenantId);
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
        response.setDescription(schedule.getDescription());
        response.setInvoiceDate(schedule.getInvoiceDate());
        response.setInvoiceUrl(schedule.getInvoiceUrl());
        response.setInvoiceFilename(schedule.getInvoiceFilename());
        response.setCreatedBy(schedule.getCreatedBy());
        response.setCreatedAt(schedule.getCreatedAt());
        
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
        response.setDescription(schedule.getDescription());
        response.setInvoiceDate(schedule.getInvoiceDate());
        response.setInvoiceUrl(schedule.getInvoiceUrl());
        response.setInvoiceFilename(schedule.getInvoiceFilename());
        response.setCreatedBy(schedule.getCreatedBy());
        response.setCreatedAt(schedule.getCreatedAt());
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

