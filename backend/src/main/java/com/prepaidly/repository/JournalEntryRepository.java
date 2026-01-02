package com.prepaidly.repository;

import com.prepaidly.model.JournalEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

/**
 * Repository for JournalEntry entity operations.
 * Provides database access methods for journal entries.
 */
@Repository
public interface JournalEntryRepository extends JpaRepository<JournalEntry, Long> {
    /**
     * Find all journal entries for a specific schedule.
     * 
     * @param scheduleId The schedule ID
     * @return List of journal entries for the schedule
     */
    List<JournalEntry> findByScheduleId(Long scheduleId);
    
    /**
     * Find journal entries by schedule ID and posted status.
     * 
     * @param scheduleId The schedule ID
     * @param posted Whether entries are posted (true) or not (false)
     * @return List of matching journal entries
     */
    List<JournalEntry> findByScheduleIdAndPosted(Long scheduleId, Boolean posted);
    
    /**
     * Find journal entries by period date and posted status.
     * 
     * @param periodDate The period date (first day of month)
     * @param posted Whether entries are posted (true) or not (false)
     * @return List of matching journal entries
     */
    List<JournalEntry> findByPeriodDateAndPosted(LocalDate periodDate, Boolean posted);
    
    /**
     * Find journal entries by tenant ID and posted status.
     * 
     * @param tenantId The Xero tenant/organization ID
     * @param posted Whether entries are posted (true) or not (false)
     * @return List of matching journal entries
     */
    List<JournalEntry> findByScheduleTenantIdAndPosted(String tenantId, Boolean posted);
}

