package com.prepaidly.controller;

import com.prepaidly.dto.PostJournalRequest;
import com.prepaidly.model.JournalEntry;
import com.prepaidly.service.JournalService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/journals")
@RequiredArgsConstructor
public class JournalController {

    private final JournalService journalService;

    @PostMapping
    public ResponseEntity<?> postJournal(@Valid @RequestBody PostJournalRequest request) {
        try {
            JournalEntry entry = journalService.postJournal(
                request.getJournalEntryId(),
                request.getTenantId()
            );
            
            return ResponseEntity.ok(Map.of(
                "success", true,
                "journalEntryId", entry.getId(),
                "xeroManualJournalId", entry.getXeroManualJournalId(),
                "message", "Journal posted successfully to Xero"
            ));
        } catch (Exception e) {
            log.error("Error posting journal", e);
            return ResponseEntity.status(500).body(Map.of(
                "success", false,
                "error", e.getMessage()
            ));
        }
    }
}

