package com.prepaidly.repository;

import com.prepaidly.model.JournalEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface JournalEntryRepository extends JpaRepository<JournalEntry, Long> {
    List<JournalEntry> findByScheduleId(Long scheduleId);
    List<JournalEntry> findByScheduleIdAndPosted(Long scheduleId, Boolean posted);
    List<JournalEntry> findByPeriodDateAndPosted(LocalDate periodDate, Boolean posted);
    List<JournalEntry> findByScheduleTenantIdAndPosted(String tenantId, Boolean posted);
}

