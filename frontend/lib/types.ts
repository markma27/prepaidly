// TypeScript type definitions for Prepaidly API responses

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
  connected: boolean;
  message: string;
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
  posted: boolean;
  createdAt: string;
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
  createdBy?: number;
  createdAt: string;
  journalEntries?: JournalEntry[];
  remainingBalance?: number;
  totalPeriods?: number;
  postedPeriods?: number;
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
  createdBy?: number;
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

