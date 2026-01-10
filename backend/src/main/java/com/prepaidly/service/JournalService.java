package com.prepaidly.service;

import com.prepaidly.model.JournalEntry;
import com.prepaidly.model.Schedule;
import com.prepaidly.repository.JournalEntryRepository;
import com.prepaidly.service.XeroApiService.JournalLine;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Slf4j
@Service
@RequiredArgsConstructor
public class JournalService {
    
    private final JournalEntryRepository journalEntryRepository;
    private final XeroApiService xeroApiService;
    
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
        
        // Verify tenant matches
        if (!schedule.getTenantId().equals(tenantId)) {
            throw new RuntimeException("Journal entry does not belong to tenant: " + tenantId);
        }
        
        // Check if already posted
        if (entry.getPosted()) {
            throw new RuntimeException("Journal entry already posted");
        }
        
        // Build journal lines based on schedule type
        List<JournalLine> journalLines = buildJournalLines(schedule, entry);
        
        // Create narration
        String narration = String.format(
            "%s Recognition - %s (Period: %s)",
            schedule.getType() == Schedule.ScheduleType.PREPAID ? "Prepayment" : "Unearned Revenue",
            schedule.getType() == Schedule.ScheduleType.PREPAID ? "Expense" : "Revenue",
            entry.getPeriodDate().toString()
        );
        
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
     * Build journal lines based on schedule type
     */
    private List<JournalLine> buildJournalLines(Schedule schedule, JournalEntry entry) {
        List<JournalLine> lines = new ArrayList<>();
        
        if (schedule.getType() == Schedule.ScheduleType.PREPAID) {
            // Prepayment: Debit Expense, Credit Deferral
            JournalLine expenseLine = new JournalLine();
            expenseLine.setAccountCode(schedule.getExpenseAcctCode());
            expenseLine.setDescription("Prepayment recognition");
            expenseLine.setLineAmount(entry.getAmount());
            lines.add(expenseLine);
            
            JournalLine deferralLine = new JournalLine();
            deferralLine.setAccountCode(schedule.getDeferralAcctCode());
            deferralLine.setDescription("Prepayment deferral reduction");
            deferralLine.setLineAmount(entry.getAmount().negate());
            lines.add(deferralLine);
        } else {
            // Unearned Revenue: Debit Deferral, Credit Revenue
            JournalLine deferralLine = new JournalLine();
            deferralLine.setAccountCode(schedule.getDeferralAcctCode());
            deferralLine.setDescription("Unearned revenue recognition");
            deferralLine.setLineAmount(entry.getAmount().negate());
            lines.add(deferralLine);
            
            JournalLine revenueLine = new JournalLine();
            revenueLine.setAccountCode(schedule.getRevenueAcctCode());
            revenueLine.setDescription("Unearned revenue recognition");
            revenueLine.setLineAmount(entry.getAmount());
            lines.add(revenueLine);
        }
        
        return lines;
    }
}

