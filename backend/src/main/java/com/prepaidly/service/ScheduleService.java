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
        schedule.setCreatedBy(request.getCreatedBy());
        
        schedule = scheduleRepository.save(schedule);
        
        // Generate journal entries
        generateJournalEntries(schedule);
        
        return toScheduleResponse(schedule);
    }
    
    /**
     * Generate monthly journal entries for a schedule
     */
    private void generateJournalEntries(Schedule schedule) {
        LocalDate startDate = schedule.getStartDate();
        LocalDate endDate = schedule.getEndDate();
        
        // Calculate number of months
        long monthsBetween = ChronoUnit.MONTHS.between(
            startDate.withDayOfMonth(1),
            endDate.withDayOfMonth(1)
        ) + 1;
        
        if (monthsBetween <= 0) {
            throw new IllegalArgumentException("Schedule must span at least one month");
        }
        
        // Calculate monthly amount
        BigDecimal monthlyAmount = schedule.getTotalAmount()
            .divide(BigDecimal.valueOf(monthsBetween), 2, RoundingMode.HALF_UP);
        
        // Generate entries for each month
        LocalDate currentDate = startDate.withDayOfMonth(1);
        BigDecimal remainingAmount = schedule.getTotalAmount();
        
        for (int i = 0; i < monthsBetween; i++) {
            JournalEntry entry = new JournalEntry();
            entry.setSchedule(schedule);
            
            // Set period date to first day of the month
            entry.setPeriodDate(currentDate);
            
            // Last entry gets the remaining amount to avoid rounding errors
            if (i == monthsBetween - 1) {
                entry.setAmount(remainingAmount);
            } else {
                entry.setAmount(monthlyAmount);
                remainingAmount = remainingAmount.subtract(monthlyAmount);
            }
            
            entry.setPosted(false);
            
            journalEntryRepository.save(entry);
            
            // Move to next month
            currentDate = currentDate.plusMonths(1);
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

