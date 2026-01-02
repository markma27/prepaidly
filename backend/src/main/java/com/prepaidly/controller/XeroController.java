package com.prepaidly.controller;

import com.prepaidly.dto.XeroAccountResponse;
import com.prepaidly.dto.XeroInvoiceResponse;
import com.prepaidly.service.XeroApiService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Xero Data Controller
 * 
 * REST controller for fetching data from Xero accounting software. This controller
 * provides read-only access to Xero data such as Chart of Accounts and Invoices.
 * 
 * All endpoints require:
 * - A valid Xero connection for the specified tenant (see XeroAuthController)
 * - Valid OAuth access tokens (automatically refreshed if needed)
 * - Proper tenant ID that matches a connected Xero organization
 * 
 * The controller acts as a proxy to Xero's API, handling:
 * - OAuth token management and refresh
 * - API request formatting
 * - Response parsing and transformation
 * - Error handling and logging
 * 
 * Data returned from these endpoints is used for:
 * - Displaying Chart of Accounts for schedule creation
 * - Showing invoices/bills for reference
 * - Account selection in the frontend
 * - Validating account codes before creating schedules
 * 
 * @apiNote All endpoints are under /api/xero
 * 
 * @note These endpoints fetch live data from Xero. For better performance in
 *       production, consider implementing caching or data synchronization.
 * 
 * @see XeroAuthController for establishing Xero connections
 * @see XeroApiService for the underlying API implementation
 */
@Slf4j
@RestController
@RequestMapping("/api/xero")
@RequiredArgsConstructor
public class XeroController {

    private final XeroApiService xeroApiService;

    /**
     * Get Chart of Accounts
     * 
     * Retrieves the Chart of Accounts for a connected Xero organization. The Chart
     * of Accounts is a list of all accounts used in the organization's accounting,
     * including expense accounts, revenue accounts, asset accounts, liability accounts,
     * and equity accounts.
     * 
     * The response includes:
     * - Account ID (Xero's unique identifier)
     * - Account Code (chart of accounts code)
     * - Account Name
     * - Account Type (e.g., "EXPENSE", "REVENUE", "ASSET", "LIABILITY")
     * - Account Status (e.g., "ACTIVE", "ARCHIVED")
     * - System Account flag (indicates if it's a Xero system account)
     * 
     * This data is essential for:
     * - Creating schedules (users need to select expense/revenue and deferral accounts)
     * - Validating account codes before posting journals
     * - Displaying account options in dropdown menus
     * 
     * @param tenantId The Xero tenant/organization ID (required)
     *                 Must match a connected Xero organization
     * 
     * @return ResponseEntity with accounts or error:
     *         - Success (200 OK): Returns XeroAccountResponse containing:
     *           {
     *             "accounts": [
     *               {
     *                 "accountID": "abc123-def456-ghi789",
     *                 "code": "6000",
     *                 "name": "Office Expenses",
     *                 "type": "EXPENSE",
     *                 "status": "ACTIVE",
     *                 "isSystemAccount": false
     *               },
     *               {
     *                 "accountID": "xyz789-abc123-def456",
     *                 "code": "2000",
     *                 "name": "Prepaid Expenses",
     *                 "type": "CURRENT_ASSET",
     *                 "status": "ACTIVE",
     *                 "isSystemAccount": false
     *               }
     *             ]
     *           }
     *         - Internal Server Error (500): Returns error if:
     *           - Xero connection not found for tenant
     *           - OAuth token refresh fails
     *           - Xero API call fails
     *           {
     *             "error": "Failed to fetch accounts: <error-message>"
     *           }
     * 
     * @apiNote GET /api/xero/accounts?tenantId={tenantId}
     * 
     * @throws RuntimeException if:
     *         - Xero connection not found for tenant
     *         - OAuth tokens cannot be refreshed
     *         - Xero API returns an error
     *         - Network/connection issues occur
     * 
     * @example Request:
     * GET /api/xero/accounts?tenantId=tenant-abc-123
     * 
     * @example Success Response:
     * {
     *   "accounts": [
     *     {
     *       "accountID": "abc123-def456",
     *       "code": "6000",
     *       "name": "Office Expenses",
     *       "type": "EXPENSE",
     *       "status": "ACTIVE",
     *       "isSystemAccount": false
     *     }
     *   ]
     * }
     * 
     * @example Error Response:
     * {
     *   "error": "Failed to fetch accounts: Xero connection not found for tenant: tenant-abc-123"
     * }
     * 
     * @usage Use this endpoint to:
     *        - Populate account dropdowns in the frontend
     *        - Validate account codes before creating schedules
     *        - Display Chart of Accounts to users
     *        - Filter accounts by type (e.g., only show EXPENSE accounts for prepaid schedules)
     * 
     * @note The endpoint automatically refreshes OAuth tokens if they're expired.
     *       If token refresh fails, the user may need to reconnect via XeroAuthController.
     * 
     * @note System accounts are typically filtered out in the frontend as they're
     *       not suitable for manual journal entries or schedules.
     * 
     * @see XeroAuthController#status(Long) to check if tenant is connected
     * @see ScheduleController#createSchedule(CreateScheduleRequest) for using accounts in schedules
     */
    @GetMapping("/accounts")
    public ResponseEntity<?> getAccounts(@RequestParam String tenantId) {
        try {
            XeroAccountResponse accounts = xeroApiService.getAccounts(tenantId);
            return ResponseEntity.ok(accounts);
        } catch (Exception e) {
            log.error("Error fetching accounts for tenant {}", tenantId, e);
            return ResponseEntity.status(500).body(Map.of(
                "error", "Failed to fetch accounts: " + e.getMessage()
            ));
        }
    }

    /**
     * Get Invoices and Bills
     * 
     * Retrieves invoices and bills for a connected Xero organization. This includes
     * both accounts receivable (invoices) and accounts payable (bills) transactions.
     * 
     * The response includes:
     * - Invoice ID (Xero's unique identifier)
     * - Invoice Number (human-readable invoice number)
     * - Invoice Type (e.g., "ACCREC" for accounts receivable, "ACCPAY" for accounts payable)
     * - Invoice Date
     * - Due Date
     * - Total Amount (including tax)
     * - Total Tax Amount
     * - Amount Due (outstanding balance)
     * - Invoice Status (e.g., "DRAFT", "SUBMITTED", "AUTHORISED", "PAID")
     * - Contact Name and ID (customer or supplier)
     * 
     * This data is useful for:
     * - Linking schedules to specific invoices/bills
     * - Reference when creating prepaid expense or unearned revenue schedules
     * - Displaying invoice history
     * - Validating invoice amounts
     * 
     * @param tenantId The Xero tenant/organization ID (required)
     *                 Must match a connected Xero organization
     * 
     * @return ResponseEntity with invoices or error:
     *         - Success (200 OK): Returns XeroInvoiceResponse containing:
     *           {
     *             "invoices": [
     *               {
     *                 "invoiceID": "abc123-def456-ghi789",
     *                 "invoiceNumber": "INV-001",
     *                 "type": "ACCREC",
     *                 "date": "2025-01-15",
     *                 "dueDate": "2025-02-15",
     *                 "total": 1000.00,
     *                 "totalTax": 100.00,
     *                 "amountDue": 1000.00,
     *                 "status": "AUTHORISED",
     *                 "contactName": "Acme Corp",
     *                 "contactID": "contact-xyz-123"
     *               },
     *               {
     *                 "invoiceID": "xyz789-abc123-def456",
     *                 "invoiceNumber": "BILL-001",
     *                 "type": "ACCPAY",
     *                 "date": "2025-01-20",
     *                 "dueDate": "2025-02-20",
     *                 "total": 500.00,
     *                 "totalTax": 50.00,
     *                 "amountDue": 500.00,
     *                 "status": "AUTHORISED",
     *                 "contactName": "Supplier Inc",
     *                 "contactID": "contact-abc-456"
     *               }
     *             ]
     *           }
     *         - Internal Server Error (500): Returns error if:
     *           - Xero connection not found for tenant
     *           - OAuth token refresh fails
     *           - Xero API call fails
     *           {
     *             "error": "Failed to fetch invoices: <error-message>"
     *           }
     * 
     * @apiNote GET /api/xero/invoices?tenantId={tenantId}
     * 
     * @throws RuntimeException if:
     *         - Xero connection not found for tenant
     *         - OAuth tokens cannot be refreshed
     *         - Xero API returns an error
     *         - Network/connection issues occur
     * 
     * @example Request:
     * GET /api/xero/invoices?tenantId=tenant-abc-123
     * 
     * @example Success Response:
     * {
     *   "invoices": [
     *     {
     *       "invoiceID": "abc123-def456",
     *       "invoiceNumber": "INV-001",
     *       "type": "ACCREC",
     *       "date": "2025-01-15",
     *       "dueDate": "2025-02-15",
     *       "total": 1000.00,
     *       "totalTax": 100.00,
     *       "amountDue": 1000.00,
     *       "status": "AUTHORISED",
     *       "contactName": "Acme Corp",
     *       "contactID": "contact-xyz-123"
     *     }
     *   ]
     * }
     * 
     * @example Error Response:
     * {
     *   "error": "Failed to fetch invoices: Xero connection not found for tenant: tenant-abc-123"
     * }
     * 
     * @usage Use this endpoint to:
     *        - Display invoices/bills in the frontend
     *        - Link schedules to specific invoices (via xeroInvoiceId field)
     *        - Reference invoice details when creating schedules
     *        - Show invoice history and status
     * 
     * @note The endpoint automatically refreshes OAuth tokens if they're expired.
     *       If token refresh fails, the user may need to reconnect via XeroAuthController.
     * 
     * @note Invoice types:
     *       - "ACCREC": Accounts Receivable (sales invoices)
     *       - "ACCPAY": Accounts Payable (bills/purchase invoices)
     * 
     * @note The response may include invoices in various statuses. Filter by status
     *       in the frontend if you only want to show certain types (e.g., only AUTHORISED).
     * 
     * @see XeroAuthController#status(Long) to check if tenant is connected
     * @see ScheduleController#createSchedule(CreateScheduleRequest) for linking schedules to invoices
     */
    @GetMapping("/invoices")
    public ResponseEntity<?> getInvoices(@RequestParam String tenantId) {
        try {
            XeroInvoiceResponse invoices = xeroApiService.getInvoices(tenantId);
            return ResponseEntity.ok(invoices);
        } catch (Exception e) {
            log.error("Error fetching invoices for tenant {}", tenantId, e);
            return ResponseEntity.status(500).body(Map.of(
                "error", "Failed to fetch invoices: " + e.getMessage()
            ));
        }
    }
}
