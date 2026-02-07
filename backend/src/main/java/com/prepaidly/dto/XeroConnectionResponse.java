package com.prepaidly.dto;

import lombok.Data;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

/**
 * Xero Connection Response DTO
 * 
 * Represents the status of a single Xero organization connection.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class XeroConnectionResponse {
    /** Xero tenant/organization ID */
    private String tenantId;
    
    /** Xero organization name */
    private String tenantName;
    
    /**
     * Connection status:
     * - true: CONNECTED and tokens are valid
     * - false: DISCONNECTED (needs re-authorization)
     * - null: not validated yet (fast path)
     */
    private Boolean connected;
    
    /** Human-readable status message */
    private String message;

    /** Reason for disconnection (null if connected) */
    private String disconnectReason;
}

