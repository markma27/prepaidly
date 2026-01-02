package com.prepaidly.dto;

import lombok.Data;

import java.util.List;

/**
 * Xero Account Response DTO
 * 
 * Data Transfer Object representing the Chart of Accounts retrieved from Xero.
 * Contains a list of all accounts in the connected Xero organization.
 * 
 * This DTO is returned by the Xero accounts endpoint and is used to:
 * - Display account options in dropdown menus
 * - Validate account codes before creating schedules
 * - Filter accounts by type (e.g., only show EXPENSE accounts)
 * 
 * Accounts include expense accounts, revenue accounts, asset accounts, liability
 * accounts, and equity accounts. System accounts are typically filtered out as
 * they're not suitable for manual journal entries.
 * 
 * @see com.prepaidly.controller.XeroController#getAccounts(String)
 */
@Data
public class XeroAccountResponse {
    /**
     * List of accounts from Xero Chart of Accounts
     * 
     * Contains all accounts in the connected Xero organization, including their
     * codes, names, types, and statuses.
     */
    private List<Account> accounts;
    
    /**
     * Account information from Xero Chart of Accounts
     * 
     * Represents a single account in the Xero Chart of Accounts. Used for account
     * selection when creating schedules.
     */
    @Data
    public static class Account {
        /**
         * Xero's unique identifier for the account
         * 
         * Used internally by Xero. Not the same as the account code.
         * Example: "abc123-def456-ghi789"
         */
        private String accountID;
        
        /**
         * Chart of Accounts code
         * 
         * The account code used in the Chart of Accounts. This is what users
         * typically see and use when selecting accounts for schedules.
         * Example: "6000", "2000", "4000"
         */
        private String code;
        
        /**
         * Account name
         * 
         * The display name of the account.
         * Example: "Office Expenses", "Prepaid Expenses", "Subscription Revenue"
         */
        private String name;
        
        /**
         * Account type
         * 
         * The type of account. Common values:
         * - "EXPENSE": Expense accounts
         * - "REVENUE": Revenue accounts
         * - "CURRENT_ASSET": Current asset accounts (e.g., Prepaid Expenses)
         * - "CURRENT_LIABILITY": Current liability accounts (e.g., Unearned Revenue)
         * - "ASSET": Other asset accounts
         * - "LIABILITY": Other liability accounts
         * - "EQUITY": Equity accounts
         * 
         * Example: "EXPENSE", "CURRENT_ASSET"
         */
        private String type;
        
        /**
         * Account status
         * 
         * Indicates whether the account is active or archived.
         * Common values: "ACTIVE", "ARCHIVED"
         * 
         * Example: "ACTIVE"
         */
        private String status;
        
        /**
         * System account flag
         * 
         * Indicates whether this is a Xero system account (e.g., default accounts
         * created by Xero). System accounts are typically not suitable for manual
         * journal entries and should be filtered out in the UI.
         * 
         * - true: System account (usually filtered out)
         * - false: User-created account (suitable for schedules)
         */
        private Boolean isSystemAccount;
    }
}

