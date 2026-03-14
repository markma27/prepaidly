package com.prepaidly.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

/**
 * Xero Balance Sheet Report Response DTO
 *
 * Represents balance sheet account balances as of a specific date from Xero.
 * Used for the Xero Reconciliation page.
 */
@Data
public class XeroBalanceSheetResponse {
    /**
     * The date as of which the balances are reported (YYYY-MM-DD)
     */
    private String reportDate;

    /**
     * List of balance sheet account lines with code, name, and amount
     */
    private List<BalanceSheetAccount> accounts;

    @Data
    public static class BalanceSheetAccount {
        /** Chart of Accounts code (e.g. "1000", "2000") */
        private String accountCode;
        /** Account display name */
        private String accountName;
        /** Balance amount as of the report date */
        private BigDecimal amount;
    }
}
