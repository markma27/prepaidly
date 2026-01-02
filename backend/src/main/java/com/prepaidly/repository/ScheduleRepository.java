package com.prepaidly.repository;

import com.prepaidly.model.Schedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository for Schedule entity operations.
 * Provides database access methods for amortization schedules.
 */
@Repository
public interface ScheduleRepository extends JpaRepository<Schedule, Long> {
    /**
     * Find all schedules for a specific Xero tenant.
     * 
     * @param tenantId The Xero tenant/organization ID
     * @return List of schedules for the tenant
     */
    List<Schedule> findByTenantId(String tenantId);
    
    /**
     * Find schedules by tenant ID and schedule type.
     * 
     * @param tenantId The Xero tenant/organization ID
     * @param type The schedule type (PREPAID or UNEARNED)
     * @return List of matching schedules
     */
    List<Schedule> findByTenantIdAndType(String tenantId, Schedule.ScheduleType type);
}

