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

/**
 * Journal Controller
 * 
 * REST controller for managing journal entry operations, specifically posting
 * journal entries to Xero. Journal entries are created as part of amortization
 * schedules (prepaid expenses or unearned revenue) and represent monthly recognition
 * entries that need to be posted to Xero accounting software.
 * 
 * This controller handles the integration with Xero's API to create manual journal
 * entries for the recognized amounts. Each journal entry corresponds to a specific
 * period (month) within a schedule and can only be posted once.
 * 
 * The controller validates tenant ownership to ensure users can only post journals
 * belonging to their own tenant/organization.
 */
@Slf4j
@RestController
@RequestMapping("/api/journals")
@RequiredArgsConstructor
public class JournalController {

    private final JournalService journalService;

    /**
     * Post Journal Entry to Xero
     * 
     * Posts a journal entry to Xero by creating a manual journal entry in the
     * connected Xero organization. The journal entry must:
     * - Exist in the system
     * - Belong to the specified tenant
     * - Not have been posted previously
     * - Be associated with a valid schedule
     * 
     * The method creates a manual journal in Xero with appropriate journal lines
     * based on the schedule type (prepaid expense or unearned revenue) and updates
     * the journal entry record with the Xero journal ID and posted status.
     * 
     * @param request PostJournalRequest containing:
     *                - journalEntryId: The ID of the journal entry to post (required)
     *                - tenantId: The tenant/organization ID (required, must match journal entry's tenant)
     * 
     * @return ResponseEntity with success or error response:
     *         - Success (200 OK): Returns JSON with:
     *           {
     *             "success": true,
     *             "journalEntryId": <entry-id>,
     *             "xeroManualJournalId": <xero-journal-id>,
     *             "message": "Journal posted successfully to Xero"
     *           }
     *         - Error (500 Internal Server Error): Returns JSON with:
     *           {
     *             "success": false,
     *             "error": "<error-message>"
     *           }
     * 
     * @apiNote POST /api/journals
     * 
     * @throws RuntimeException if:
     *         - Journal entry not found
     *         - Journal entry does not belong to the specified tenant
     *         - Journal entry has already been posted
     *         - Xero API call fails
     *         - Schedule or account information is invalid
     * 
     * @example Request:
     * {
     *   "journalEntryId": 123,
     *   "tenantId": "tenant-abc-123"
     * }
     * 
     * @example Success Response:
     * {
     *   "success": true,
     *   "journalEntryId": 123,
     *   "xeroManualJournalId": "abc123-def456-ghi789",
     *   "message": "Journal posted successfully to Xero"
     * }
     * 
     * @usage This endpoint requires:
     *        - Valid Xero connection for the tenant (see XeroAuthController)
     *        - Journal entry must exist and belong to the tenant
     *        - Journal entry must not have been posted before
     *        - Associated schedule must have valid account codes
     */
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

