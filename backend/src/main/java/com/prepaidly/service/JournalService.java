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
        JournalEntry entry = journalEntryRepository.findById(journalEntryId)
            .orElseThrow(() -> new RuntimeException("Journal entry not found: " + journalEntryId));
        
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
            schedule.getType() == Schedule.ScheduleType.PREPAID ? "Prepaid Expense" : "Unearned Revenue",
            schedule.getType() == Schedule.ScheduleType.PREPAID ? "Expense" : "Revenue",
            entry.getPeriodDate().toString()
        );
        
        try {
            // Create manual journal in Xero
            String xeroJournalId = xeroApiService.createManualJournal(
                tenantId,
                narration,
                entry.getPeriodDate(),
                journalLines
            );
            
            // Update journal entry
            entry.setXeroManualJournalId(xeroJournalId);
            entry.setPosted(true);
            
            return journalEntryRepository.save(entry);
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
            // Prepaid Expense: Debit Expense, Credit Deferral
            JournalLine expenseLine = new JournalLine();
            expenseLine.setAccountCode(schedule.getExpenseAcctCode());
            expenseLine.setDescription("Prepaid expense recognition");
            expenseLine.setLineAmount(entry.getAmount());
            lines.add(expenseLine);
            
            JournalLine deferralLine = new JournalLine();
            deferralLine.setAccountCode(schedule.getDeferralAcctCode());
            deferralLine.setDescription("Prepaid expense deferral reduction");
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

