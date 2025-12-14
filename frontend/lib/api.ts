// API client for Prepaidly backend
import {
  XeroAccountResponse,
  XeroConnectionStatusResponse,
  Schedule,
  CreateScheduleRequest,
  PostJournalRequest,
  PostJournalResponse,
} from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    let errorMessage = `API request failed: ${response.statusText}`;
    let errorData;
    
    try {
      errorData = await response.json();
      if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // If response is not JSON, use default error message
    }
    
    throw new ApiError(errorMessage, response.status, errorData);
  }

  return response.json();
}

// Xero Auth API
export const xeroAuthApi = {
  /**
   * Get Xero connection status
   */
  getStatus: async (userId?: number): Promise<XeroConnectionStatusResponse> => {
    const params = userId ? `?userId=${userId}` : '';
    return fetchApi<XeroConnectionStatusResponse>(`/api/auth/xero/status${params}`);
  },

  /**
   * Get Xero authorization URL (redirects to Xero login)
   */
  getConnectUrl: (userId?: number): string => {
    const params = userId ? `?userId=${userId}` : '';
    return `${API_BASE_URL}/api/auth/xero/connect${params}`;
  },
};

// Xero Data API
export const xeroApi = {
  /**
   * Get accounts (Chart of Accounts) for a tenant
   */
  getAccounts: async (tenantId: string): Promise<XeroAccountResponse> => {
    return fetchApi<XeroAccountResponse>(`/api/xero/accounts?tenantId=${encodeURIComponent(tenantId)}`);
  },

  /**
   * Get invoices for a tenant
   */
  getInvoices: async (tenantId: string) => {
    return fetchApi(`/api/xero/invoices?tenantId=${encodeURIComponent(tenantId)}`);
  },
};

// Schedule API
export const scheduleApi = {
  /**
   * Create a new schedule
   */
  createSchedule: async (request: CreateScheduleRequest): Promise<Schedule> => {
    return fetchApi<Schedule>('/api/schedules', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Get all schedules for a tenant
   */
  getSchedules: async (tenantId: string): Promise<{ schedules: Schedule[]; count: number }> => {
    return fetchApi<{ schedules: Schedule[]; count: number }>(
      `/api/schedules?tenantId=${encodeURIComponent(tenantId)}`
    );
  },

  /**
   * Get a specific schedule by ID
   */
  getSchedule: async (id: number): Promise<Schedule> => {
    return fetchApi<Schedule>(`/api/schedules/${id}`);
  },
};

// Journal API
export const journalApi = {
  /**
   * Post a journal entry to Xero
   */
  postJournal: async (request: PostJournalRequest): Promise<PostJournalResponse> => {
    return fetchApi<PostJournalResponse>('/api/journals', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },
};

// Sync API
export const syncApi = {
  /**
   * Sync and refresh tokens for a tenant
   */
  sync: async (tenantId: string) => {
    return fetchApi(`/api/sync?tenantId=${encodeURIComponent(tenantId)}`, {
      method: 'POST',
    });
  },
};

export { ApiError };

