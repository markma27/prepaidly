package com.prepaidly.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * Post Journal Request DTO
 * 
 * Data Transfer Object for posting a journal entry to Xero. Used as the request
 * body for the journal posting endpoint.
 * 
 * This DTO contains the minimal information needed to post a journal entry:
 * - The journal entry ID to post
 * - The tenant ID for verification and API calls
 * 
 * The system will:
 * 1. Verify the journal entry exists and belongs to the tenant
 * 2. Check that it hasn't been posted already
 * 3. Create a manual journal entry in Xero
 * 4. Update the journal entry with the Xero journal ID and posted status
 * 
 * @see JournalEntryResponse for the journal entry structure
 * @see com.prepaidly.controller.JournalController#postJournal(PostJournalRequest)
 */
@Data
public class PostJournalRequest {
    /**
     * Journal entry ID to post
     * 
     * The unique identifier of the journal entry that should be posted to Xero.
     * The entry must exist, belong to the specified tenant, and not have been
     * posted already.
     * 
     * Required: Yes
     * Example: 123
     */
    @NotNull(message = "Journal entry ID is required")
    private Long journalEntryId;
    
    /**
     * Xero tenant/organization ID
     * 
     * Identifies which Xero organization to post the journal to. Must match the
     * tenant ID of the schedule that the journal entry belongs to. Used for
     * verification and API authentication.
     * 
     * Required: Yes
     * Example: "tenant-abc-123"
     */
    @NotNull(message = "Tenant ID is required")
    private String tenantId;
}

