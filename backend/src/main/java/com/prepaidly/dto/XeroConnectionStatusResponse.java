package com.prepaidly.dto;

import lombok.Data;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Xero Connection Status Response DTO
 * 
 * Data Transfer Object representing the status of all Xero organization connections
 * for a user. Contains a list of connection statuses and a total count.
 * 
 * This DTO is returned by the connection status endpoint to provide a comprehensive
 * view of all connected Xero organizations and their current status. Each connection
 * in the list represents one Xero organization that the user has connected.
 * 
 * @see XeroConnectionResponse for individual connection details
 * @see com.prepaidly.controller.XeroAuthController#status(Long)
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class XeroConnectionStatusResponse {
    /**
     * List of Xero connection statuses
     * 
     * Contains the status information for each connected Xero organization.
     * Each entry includes tenant ID, name, connection status, and status message.
     * 
     * The list may be empty if no connections exist, or may contain multiple
     * entries if the user has connected multiple Xero organizations.
     * 
     * @see XeroConnectionResponse
     */
    private List<XeroConnectionResponse> connections;
    
    /**
     * Total number of connections
     * 
     * The count of Xero organizations connected. This matches the size of the
     * connections list. Provided for convenience and quick reference.
     * 
     * Example: 0 (no connections), 1 (one organization), 3 (three organizations)
     */
    private Integer totalConnections;
}

