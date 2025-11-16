package com.prepaidly.repository;

import com.prepaidly.model.Schedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ScheduleRepository extends JpaRepository<Schedule, Long> {
    List<Schedule> findByTenantId(String tenantId);
    List<Schedule> findByTenantIdAndType(String tenantId, Schedule.ScheduleType type);
}

