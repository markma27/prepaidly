package com.prepaidly.controller;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/schedules")
public class ScheduleController {

    @PostMapping
    public ResponseEntity<String> createSchedule(@RequestBody Object scheduleDto) {
        // TODO: Create amortisation schedule
        return ResponseEntity.ok("Create schedule endpoint - to be implemented");
    }

    @GetMapping
    public ResponseEntity<String> getSchedules(@RequestParam String tenantId) {
        // TODO: List schedules for tenant
        return ResponseEntity.ok("List schedules endpoint - to be implemented");
    }
}

