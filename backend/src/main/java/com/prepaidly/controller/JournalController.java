package com.prepaidly.controller;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/journals")
public class JournalController {

    @PostMapping
    public ResponseEntity<String> postJournal(@RequestBody Object journalDto) {
        // TODO: Post monthly journal to Xero
        return ResponseEntity.ok("Post journal endpoint - to be implemented");
    }
}

