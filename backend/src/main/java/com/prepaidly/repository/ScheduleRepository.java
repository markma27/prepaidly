package com.prepaidly.repository;

import com.prepaidly.model.Schedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
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

    /**
     * Find distinct non-null contact names for a specific tenant.
     * Used for autocomplete suggestions when creating new schedules.
     */
    @Query("SELECT DISTINCT s.contactName FROM Schedule s WHERE s.tenantId = :tenantId AND s.contactName IS NOT NULL AND s.contactName <> '' ORDER BY s.contactName")
    List<String> findDistinctContactNamesByTenantId(@Param("tenantId") String tenantId);
}

