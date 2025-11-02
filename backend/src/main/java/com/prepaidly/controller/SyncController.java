package com.prepaidly.controller;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/sync")
public class SyncController {

    @PostMapping
    public ResponseEntity<String> sync(@RequestParam String tenantId) {
        // TODO: Refresh tokens and sync data
        return ResponseEntity.ok("Sync endpoint - to be implemented");
    }
}

