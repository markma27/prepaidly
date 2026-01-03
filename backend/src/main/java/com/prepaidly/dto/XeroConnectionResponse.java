package com.prepaidly.dto;

import lombok.Data;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

/**
 * Xero Connection Response DTO
 * 
 * Data Transfer Object representing the status of a single Xero organization
 * connection. Used in responses to indicate whether a Xero organization is
 * connected and accessible.
 * 
 * This DTO is used in the connection status endpoint to show the status of
 * each connected Xero organization. It includes the tenant ID, name, connection
 * status, and any status messages.
 * 
 * @see XeroConnectionStatusResponse which contains a list of these
 * @see com.prepaidly.controller.XeroAuthController#status(Long)
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class XeroConnectionResponse {
    /**
     * Xero tenant/organization ID
     * 
     * The unique identifier for the Xero organization. This is used to identify
     * which organization the connection status refers to.
     * Example: "tenant-abc-123"
     */
    private String tenantId;
    
    /**
     * Xero organization name
     * 
     * The display name of the connected Xero organization as retrieved from
     * Xero's API. Shows "Unknown" if the name cannot be retrieved.
     * Example: "Demo Company", "Acme Corp"
     */
    private String tenantName;
    
    /**
     * Connection status
     * 
     * Indicates whether the connection to this Xero organization is currently
     * valid and can be used to make API calls.
     * 
     * - true: Connection is valid and tokens are working
     * - false: Connection has issues (e.g., tokens expired, API error)
     * - null: Connection status not validated yet (fast path - tenant name available from DB)
     */
    private Boolean connected;
    
    /**
     * Status message
     * 
     * Human-readable message describing the connection status. Provides additional
     * information about the connection state or any errors encountered.
     * 
     * Examples:
     * - "Connected" (when connection is valid)
     * - "Error: Refresh token expired" (when connection failed)
     * - "Error: Failed to verify connection with Xero" (when API call failed)
     */
    private String message;
}

