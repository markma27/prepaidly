package com.prepaidly.service;

import com.prepaidly.model.JournalEntry;
import com.prepaidly.model.Schedule;
import com.prepaidly.model.TenantSettings;
import com.prepaidly.repository.JournalEntryRepository;
import com.prepaidly.repository.TenantSettingsRepository;
import com.prepaidly.service.XeroApiService.JournalLine;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Slf4j
@Service
@RequiredArgsConstructor
public class JournalService {
    
    private final JournalEntryRepository journalEntryRepository;
    private final XeroApiService xeroApiService;
    private final TenantSettingsRepository tenantSettingsRepository;
    
    /**
     * Post a journal entry to Xero
     */
    @Transactional
    public JournalEntry postJournal(Long journalEntryId, String tenantId) {
        JournalEntry entry = Objects.requireNonNull(
            journalEntryRepository.findById(Objects.requireNonNull(journalEntryId, "Journal entry ID cannot be null"))
                .orElseThrow(() -> new RuntimeException("Journal entry not found: " + journalEntryId)),
            "Journal entry cannot be null"
        );
        
        Schedule schedule = entry.getSchedule();
        
        // Reject posting for voided schedules
        if (Boolean.TRUE.equals(schedule.getVoided())) {
            throw new RuntimeException("Cannot post journal: schedule has been voided");
        }
        
        // Verify tenant matches
        if (!schedule.getTenantId().equals(tenantId)) {
            throw new RuntimeException("Journal entry does not belong to tenant: " + tenantId);
        }
        
        // Check if already posted
        if (entry.getPosted()) {
            throw new RuntimeException("Journal entry already posted");
        }

        // Check conversion date (lock date) - journals on or before conversion date cannot be posted
        TenantSettings settings = tenantSettingsRepository.findByTenantId(tenantId).orElse(null);
        if (settings != null && settings.getConversionDate() != null) {
            LocalDate periodDate = entry.getPeriodDate();
            if (periodDate != null && !periodDate.isAfter(settings.getConversionDate())) {
                throw new RuntimeException("Cannot post journal: period date " + periodDate + " is on or before conversion date " + settings.getConversionDate());
            }
        }
        
        // Entry index (1-based) and total count for "1 of 4" in line description
        List<JournalEntry> scheduleEntries = journalEntryRepository.findByScheduleId(schedule.getId());
        scheduleEntries.sort((a, b) -> a.getPeriodDate().compareTo(b.getPeriodDate()));
        int entryIndex = 1;
        for (int i = 0; i < scheduleEntries.size(); i++) {
            if (scheduleEntries.get(i).getId().equals(entry.getId())) {
                entryIndex = i + 1;
                break;
            }
        }
        int totalJournals = scheduleEntries.size();

        // Build journal lines (description includes Total Amount and "1 of 4")
        List<JournalLine> journalLines = buildJournalLines(schedule, entry, entryIndex, totalJournals);

        // Narration: "Prepayment - Contact | Schedule: start to end" (no Total Amount)
        StringBuilder narrationBuilder = new StringBuilder();
        narrationBuilder.append(schedule.getType() == Schedule.ScheduleType.PREPAID ? "Prepayment" : "Unearned Revenue");
        if (schedule.getContactName() != null && !schedule.getContactName().isEmpty()) {
            narrationBuilder.append(" - ").append(schedule.getContactName());
        }
        narrationBuilder.append(String.format(" | Schedule: %s to %s",
            schedule.getStartDate().toString(),
            schedule.getEndDate().toString()
        ));
        String narration = narrationBuilder.toString();
        
        try {
            // Create manual journal in Xero
            com.prepaidly.service.XeroApiService.ManualJournalResult result = xeroApiService.createManualJournal(
                tenantId,
                narration,
                entry.getPeriodDate(),
                journalLines
            );
            
            // Update journal entry
            entry.setXeroManualJournalId(result.getJournalId());
            if (result.getJournalNumber() != null) {
                entry.setXeroJournalNumber(result.getJournalNumber());
            }
            entry.setPosted(true);
            java.time.LocalDateTime now = java.time.LocalDateTime.now();
            entry.setPostedAt(now);
            log.info("Setting postedAt to {} for journal entry {}", now, journalEntryId);
            
            JournalEntry saved = journalEntryRepository.save(entry);
            log.info("Saved journal entry {} with postedAt: {}, updatedAt: {}", 
                journalEntryId, saved.getPostedAt(), saved.getUpdatedAt());
            return saved;
        } catch (Exception e) {
            log.error("Error posting journal entry {} to Xero", journalEntryId, e);
            throw new RuntimeException("Failed to post journal to Xero: " + e.getMessage(), e);
        }
    }
    
    /**
     * Build journal lines based on schedule type. Line description = description | Total Amount | "1 of 4".
     */
    private List<JournalLine> buildJournalLines(Schedule schedule, JournalEntry entry, int entryIndex, int totalJournals) {
        List<JournalLine> lines = new ArrayList<>();
        String descPart = (schedule.getDescription() != null && !schedule.getDescription().isEmpty())
            ? schedule.getDescription()
            : (schedule.getType() == Schedule.ScheduleType.PREPAID ? "Prepayment" : "Unearned revenue");
        String lineDescription = String.format("%s | Total Amount: $%,.2f | %d of %d",
            descPart, schedule.getTotalAmount(), entryIndex, totalJournals);
        
        if (schedule.getType() == Schedule.ScheduleType.PREPAID) {
            // Prepayment: Debit Expense, Credit Deferral
            JournalLine expenseLine = new JournalLine();
            expenseLine.setAccountCode(schedule.getExpenseAcctCode());
            expenseLine.setDescription(lineDescription);
            expenseLine.setLineAmount(entry.getAmount());
            lines.add(expenseLine);
            
            JournalLine deferralLine = new JournalLine();
            deferralLine.setAccountCode(schedule.getDeferralAcctCode());
            deferralLine.setDescription(lineDescription);
            deferralLine.setLineAmount(entry.getAmount().negate());
            lines.add(deferralLine);
        } else {
            // Unearned Revenue: Debit Deferral, Credit Revenue
            JournalLine deferralLine = new JournalLine();
            deferralLine.setAccountCode(schedule.getDeferralAcctCode());
            deferralLine.setDescription(lineDescription);
            deferralLine.setLineAmount(entry.getAmount().negate());
            lines.add(deferralLine);
            
            JournalLine revenueLine = new JournalLine();
            revenueLine.setAccountCode(schedule.getRevenueAcctCode());
            revenueLine.setDescription(lineDescription);
            revenueLine.setLineAmount(entry.getAmount());
            lines.add(revenueLine);
        }
        
        return lines;
    }

    /**
     * Post a write-off (full recognition) journal entry to Xero.
     * The entry must have writeOff=true and amount = remaining balance to be written off.
     */
    @Transactional
    public JournalEntry postWriteOffJournal(Long journalEntryId, String tenantId) {
        JournalEntry entry = Objects.requireNonNull(
            journalEntryRepository.findById(Objects.requireNonNull(journalEntryId, "Journal entry ID cannot be null"))
                .orElseThrow(() -> new RuntimeException("Journal entry not found: " + journalEntryId)),
            "Journal entry cannot be null"
        );
        if (!Boolean.TRUE.equals(entry.getWriteOff())) {
            throw new RuntimeException("Journal entry is not a write-off entry");
        }
        Schedule schedule = entry.getSchedule();
        if (!schedule.getTenantId().equals(tenantId)) {
            throw new RuntimeException("Journal entry does not belong to tenant: " + tenantId);
        }
        if (Boolean.TRUE.equals(schedule.getVoided())) {
            throw new RuntimeException("Cannot post write-off: schedule has been voided");
        }
        if (entry.getPosted()) {
            throw new RuntimeException("Write-off journal entry already posted");
        }

        // Check conversion date for write-off entries too
        TenantSettings settings = tenantSettingsRepository.findByTenantId(tenantId).orElse(null);
        if (settings != null && settings.getConversionDate() != null) {
            LocalDate periodDate = entry.getPeriodDate();
            if (periodDate != null && !periodDate.isAfter(settings.getConversionDate())) {
                throw new RuntimeException("Cannot post write-off journal: period date " + periodDate + " is on or before conversion date " + settings.getConversionDate());
            }
        }

        List<JournalLine> journalLines = buildWriteOffJournalLines(schedule, entry);
        String narration = (schedule.getType() == Schedule.ScheduleType.PREPAID ? "Prepayment" : "Unearned Revenue")
            + " - Full recognition (write-off)"
            + (schedule.getContactName() != null && !schedule.getContactName().isEmpty() ? " - " + schedule.getContactName() : "")
            + " | Schedule: " + schedule.getStartDate() + " to " + schedule.getEndDate();
        try {
            com.prepaidly.service.XeroApiService.ManualJournalResult result = xeroApiService.createManualJournal(
                tenantId,
                narration,
                entry.getPeriodDate(),
                journalLines
            );
            entry.setXeroManualJournalId(result.getJournalId());
            if (result.getJournalNumber() != null) {
                entry.setXeroJournalNumber(result.getJournalNumber());
            }
            entry.setPosted(true);
            entry.setPostedAt(java.time.LocalDateTime.now());
            return journalEntryRepository.save(entry);
        } catch (Exception e) {
            log.error("Error posting write-off journal entry {} to Xero", journalEntryId, e);
            throw new RuntimeException("Failed to post write-off to Xero: " + e.getMessage(), e);
        }
    }

    private List<JournalLine> buildWriteOffJournalLines(Schedule schedule, JournalEntry entry) {
        List<JournalLine> lines = new ArrayList<>();
        String lineDescription = "Fully recognised (write-off) | " + (schedule.getDescription() != null && !schedule.getDescription().isEmpty() ? schedule.getDescription() : (schedule.getType() == Schedule.ScheduleType.PREPAID ? "Prepayment" : "Unearned revenue"));
        if (schedule.getType() == Schedule.ScheduleType.PREPAID) {
            JournalLine expenseLine = new JournalLine();
            expenseLine.setAccountCode(schedule.getExpenseAcctCode());
            expenseLine.setDescription(lineDescription);
            expenseLine.setLineAmount(entry.getAmount());
            lines.add(expenseLine);
            JournalLine deferralLine = new JournalLine();
            deferralLine.setAccountCode(schedule.getDeferralAcctCode());
            deferralLine.setDescription(lineDescription);
            deferralLine.setLineAmount(entry.getAmount().negate());
            lines.add(deferralLine);
        } else {
            JournalLine deferralLine = new JournalLine();
            deferralLine.setAccountCode(schedule.getDeferralAcctCode());
            deferralLine.setDescription(lineDescription);
            deferralLine.setLineAmount(entry.getAmount().negate());
            lines.add(deferralLine);
            JournalLine revenueLine = new JournalLine();
            revenueLine.setAccountCode(schedule.getRevenueAcctCode());
            revenueLine.setDescription(lineDescription);
            revenueLine.setLineAmount(entry.getAmount());
            lines.add(revenueLine);
        }
        return lines;
    }
}

