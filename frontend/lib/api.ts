// API client for Prepaidly backend
import {
  XeroAccountResponse,
  XeroConnectionStatusResponse,
  Schedule,
  CreateScheduleRequest,
  PostJournalRequest,
  PostJournalResponse,
} from './types';

// API base URL - must be set in Vercel environment variables for production
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 
  (typeof window !== 'undefined' && window.location.hostname === 'localhost' 
    ? 'http://localhost:8080' 
    : '');

if (!API_BASE_URL && typeof window !== 'undefined') {
  console.error('NEXT_PUBLIC_API_URL is not set! Please configure it in Vercel environment variables.');
}

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
  if (!API_BASE_URL) {
    throw new ApiError(
      'API base URL is not configured. Please set NEXT_PUBLIC_API_URL environment variable in Vercel.',
      500
    );
  }

  const url = `${API_BASE_URL}${endpoint}`;
  
  try {
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
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    // Network error or other fetch errors
    throw new ApiError(
      `Failed to connect to backend API at ${API_BASE_URL}. Please check if the backend is running and NEXT_PUBLIC_API_URL is correctly configured.`,
      0,
      { originalError: error instanceof Error ? error.message : String(error) }
    );
  }
}

// Xero Auth API
export const xeroAuthApi = {
  /**
   * Get Xero connection status
   * @param userId Optional user ID
   * @param validateTokens If true, validates tokens (slower). If false, returns stored names immediately (faster).
   */
  getStatus: async (userId?: number, validateTokens: boolean = false): Promise<XeroConnectionStatusResponse> => {
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId.toString());
    params.append('validateTokens', validateTokens.toString());
    return fetchApi<XeroConnectionStatusResponse>(`/api/auth/xero/status?${params.toString()}`);
  },

  /**
   * Get Xero authorization URL (redirects to Xero login)
   */
  getConnectUrl: (userId?: number): string => {
    if (!API_BASE_URL) {
      throw new ApiError(
        'API base URL is not configured. Please set NEXT_PUBLIC_API_URL environment variable.',
        500
      );
    }
    const params = userId ? `?userId=${userId}` : '';
    return `${API_BASE_URL}/api/auth/xero/connect${params}`;
  },

  /**
   * Disconnect from Xero (delete connection)
   */
  disconnect: async (tenantId: string): Promise<{ success: boolean; message: string }> => {
    return fetchApi<{ success: boolean; message: string }>(
      `/api/auth/xero/disconnect?tenantId=${encodeURIComponent(tenantId)}`,
      {
        method: 'DELETE',
      }
    );
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
   * Get distinct contact names for autocomplete
   */
  getContactNames: async (tenantId: string): Promise<{ contactNames: string[] }> => {
    return fetchApi<{ contactNames: string[] }>(
      `/api/schedules/contacts?tenantId=${encodeURIComponent(tenantId)}`
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

  /**
   * Refresh all Xero OAuth tokens
   * This refreshes tokens for all connected Xero organizations
   */
  refreshAll: async () => {
    return fetchApi<{ success: boolean; message: string }>('/api/sync/refresh-all', {
      method: 'POST',
    });
  },
};

// Auth API
export const authApi = {
  /**
   * Login with email and password
   * Note: This is a placeholder. Backend authentication needs to be implemented.
   * For now, this verifies the user exists.
   */
  login: async (email: string, password: string): Promise<{ user: any; token?: string }> => {
    // TODO: Replace with actual login endpoint when backend implements authentication
    // For now, verify user exists
    const userResponse = await fetchApi<any>(`/api/users/email/${encodeURIComponent(email)}`);
    
    // In production, this should be:
    // return fetchApi<{ user: any; token: string }>('/api/auth/login', {
    //   method: 'POST',
    //   body: JSON.stringify({ email, password }),
    // });
    
    return { user: userResponse };
  },
};

// Settings API
export const settingsApi = {
  /**
   * Get tenant settings (default accounts)
   */
  getSettings: async (tenantId: string): Promise<{ prepaymentAccount: string; unearnedAccount: string }> => {
    return fetchApi<{ prepaymentAccount: string; unearnedAccount: string }>(
      `/api/settings?tenantId=${encodeURIComponent(tenantId)}`
    );
  },

  /**
   * Save tenant settings (default accounts)
   */
  saveSettings: async (tenantId: string, settings: { prepaymentAccount: string; unearnedAccount: string }): Promise<{ prepaymentAccount: string; unearnedAccount: string }> => {
    return fetchApi<{ prepaymentAccount: string; unearnedAccount: string }>(
      `/api/settings?tenantId=${encodeURIComponent(tenantId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(settings),
      }
    );
  },
};

export { ApiError };

