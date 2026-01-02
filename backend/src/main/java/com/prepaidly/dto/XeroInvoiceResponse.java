package com.prepaidly.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Xero Invoice Response DTO
 * 
 * Data Transfer Object representing invoices and bills retrieved from Xero.
 * Contains a list of all invoices (accounts receivable) and bills (accounts payable)
 * in the connected Xero organization.
 * 
 * This DTO is returned by the Xero invoices endpoint and is used to:
 * - Display invoices/bills in the frontend
 * - Link schedules to specific invoices (via invoice ID)
 * - Reference invoice details when creating schedules
 * - Show invoice history and status
 * 
 * The response includes both accounts receivable (invoices) and accounts payable
 * (bills) transactions, distinguished by the type field.
 * 
 * @see com.prepaidly.controller.XeroController#getInvoices(String)
 */
@Data
public class XeroInvoiceResponse {
    /**
     * List of invoices and bills from Xero
     * 
     * Contains all invoices (accounts receivable) and bills (accounts payable)
     * in the connected Xero organization, including their details, amounts,
     * dates, and statuses.
     */
    private List<Invoice> invoices;
    
    /**
     * Invoice or Bill information from Xero
     * 
     * Represents a single invoice (accounts receivable) or bill (accounts payable)
     * transaction in Xero. Used for reference when creating schedules or displaying
     * invoice information.
     */
    @Data
    public static class Invoice {
        /**
         * Xero's unique identifier for the invoice/bill
         * 
         * Used to link schedules to specific invoices. This is the ID that should
         * be stored in the schedule's xeroInvoiceId field.
         * Example: "abc123-def456-ghi789"
         */
        private String invoiceID;
        
        /**
         * Invoice/bill number
         * 
         * Human-readable invoice or bill number assigned by Xero or the user.
         * Example: "INV-001", "BILL-2025-01"
         */
        private String invoiceNumber;
        
        /**
         * Invoice type
         * 
         * Indicates whether this is an accounts receivable invoice or accounts
         * payable bill.
         * 
         * - "ACCREC": Accounts Receivable (sales invoice)
         * - "ACCPAY": Accounts Payable (bill/purchase invoice)
         * 
         * Example: "ACCREC", "ACCPAY"
         */
        private String type;
        
        /**
         * Invoice/bill date
         * 
         * The date the invoice or bill was issued.
         * Example: "2025-01-15"
         */
        private LocalDate date;
        
        /**
         * Due date
         * 
         * The date by which the invoice or bill should be paid.
         * Example: "2025-02-15"
         */
        private LocalDate dueDate;
        
        /**
         * Total amount (including tax)
         * 
         * The total amount of the invoice or bill, including all taxes.
         * Example: 1000.00
         */
        private BigDecimal total;
        
        /**
         * Total tax amount
         * 
         * The total amount of tax included in the invoice or bill.
         * Example: 100.00
         */
        private BigDecimal totalTax;
        
        /**
         * Amount due (outstanding balance)
         * 
         * The amount that is still outstanding/unpaid. This may be less than the
         * total if partial payments have been made.
         * Example: 1000.00 (if unpaid), 500.00 (if partially paid)
         */
        private BigDecimal amountDue;
        
        /**
         * Invoice/bill status
         * 
         * The current status of the invoice or bill in Xero.
         * 
         * Common values:
         * - "DRAFT": Draft invoice, not yet finalized
         * - "SUBMITTED": Submitted but not yet authorized
         * - "AUTHORISED": Authorized and ready for payment
         * - "PAID": Fully paid
         * - "VOIDED": Voided/cancelled
         * 
         * Example: "AUTHORISED", "PAID"
         */
        private String status;
        
        /**
         * Contact name
         * 
         * The name of the customer (for invoices) or supplier (for bills).
         * Example: "Acme Corp", "Supplier Inc"
         */
        private String contactName;
        
        /**
         * Contact ID
         * 
         * Xero's unique identifier for the customer or supplier contact.
         * Example: "contact-xyz-123"
         */
        private String contactID;
    }
}

