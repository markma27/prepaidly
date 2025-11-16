package com.prepaidly.controller;

import com.prepaidly.dto.CreateScheduleRequest;
import com.prepaidly.dto.ScheduleResponse;
import com.prepaidly.service.ScheduleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/schedules")
@RequiredArgsConstructor
public class ScheduleController {

    private final ScheduleService scheduleService;

    @PostMapping
    public ResponseEntity<?> createSchedule(@Valid @RequestBody CreateScheduleRequest request) {
        try {
            ScheduleResponse schedule = scheduleService.createSchedule(request);
            return ResponseEntity.ok(schedule);
        } catch (IllegalArgumentException e) {
            log.error("Invalid schedule request", e);
            return ResponseEntity.badRequest().body(Map.of(
                "error", e.getMessage()
            ));
        } catch (Exception e) {
            log.error("Error creating schedule", e);
            return ResponseEntity.status(500).body(Map.of(
                "error", "Failed to create schedule: " + e.getMessage()
            ));
        }
    }

    @GetMapping
    public ResponseEntity<?> getSchedules(@RequestParam String tenantId) {
        try {
            List<ScheduleResponse> schedules = scheduleService.getSchedulesByTenant(tenantId);
            return ResponseEntity.ok(Map.of(
                "schedules", schedules,
                "count", schedules.size()
            ));
        } catch (Exception e) {
            log.error("Error fetching schedules", e);
            return ResponseEntity.status(500).body(Map.of(
                "error", "Failed to fetch schedules: " + e.getMessage()
            ));
        }
    }
    
    @GetMapping("/{id}")
    public ResponseEntity<?> getSchedule(@PathVariable Long id) {
        try {
            ScheduleResponse schedule = scheduleService.getScheduleById(id);
            return ResponseEntity.ok(schedule);
        } catch (Exception e) {
            log.error("Error fetching schedule {}", id, e);
            return ResponseEntity.status(500).body(Map.of(
                "error", "Failed to fetch schedule: " + e.getMessage()
            ));
        }
    }
}

