// TypeScript type definitions for Prepaidly API responses

/** User as returned by /api/users and /api/users/by-tenant */
export interface UserListItem {
  id: number;
  email: string;
  role?: string;
  lastLogin?: string;
  createdAt: string;
}

export interface XeroAccount {
  accountID: string;
  code: string;
  name: string;
  type: string;
  status: string;
  isSystemAccount?: boolean;
}

export interface XeroAccountResponse {
  accounts: XeroAccount[];
}

export interface XeroConnection {
  tenantId: string;
  tenantName: string;
  connected: boolean | null; // null means "unknown" - not validated yet
  message: string;
  disconnectReason?: string | null; // reason for disconnection (null if connected)
  timezone?: string | null; // Xero org timezone (e.g., "NEWZEALANDSTANDARDTIME")
  countryCode?: string | null; // Xero org country code (e.g., "NZ", "US", "AU")
  baseCurrency?: string | null; // Xero org base currency (e.g., "NZD", "USD", "AUD")
}

export interface XeroConnectionStatusResponse {
  connections: XeroConnection[];
  totalConnections: number;
}

export type ScheduleType = 'PREPAID' | 'UNEARNED';

export interface JournalEntry {
  id: number;
  scheduleId: number;
  periodDate: string;
  amount: number;
  xeroManualJournalId?: string;
  xeroJournalNumber?: number;
  posted: boolean;
  createdAt: string;
  postedAt?: string;
  updatedAt?: string;
}

export interface Schedule {
  id: number;
  tenantId: string;
  xeroInvoiceId?: string;
  type: ScheduleType;
  startDate: string;
  endDate: string;
  totalAmount: number;
  expenseAcctCode?: string;
  revenueAcctCode?: string;
  deferralAcctCode: string;
  contactName?: string;
  invoiceReference?: string;
  description?: string;
  invoiceDate?: string;
  invoiceUrl?: string;
  invoiceFilename?: string;
  createdBy?: number;
  createdByName?: string;
  createdAt: string;
  journalEntries?: JournalEntry[];
  remainingBalance?: number;
  totalPeriods?: number;
  postedPeriods?: number;
  voided?: boolean;
}

export interface CreateScheduleRequest {
  tenantId: string;
  xeroInvoiceId?: string;
  type: ScheduleType;
  startDate: string;
  endDate: string;
  totalAmount: number;
  expenseAcctCode?: string;
  revenueAcctCode?: string;
  deferralAcctCode: string;
  contactName?: string;
  invoiceReference?: string;
  description?: string;
  invoiceDate?: string;
  invoiceUrl?: string;
  invoiceFilename?: string;
  createdBy?: number;
  /** 'actual' = daily pro-rata, 'equal' = equal monthly amount. Defaults to 'actual'. */
  allocationMethod?: 'actual' | 'equal';
}

export interface PostJournalRequest {
  journalEntryId: number;
  tenantId: string;
}

export interface PostJournalResponse {
  success: boolean;
  journalEntryId: number;
  xeroManualJournalId: string;
  message: string;
}

export interface VoidScheduleResponse {
  success: boolean;
  message: string;
  schedule?: Schedule;
  voidedJournalIds?: string[];
  failedJournalIds?: string[];
}

