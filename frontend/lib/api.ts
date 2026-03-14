// API client for Prepaidly backend
import {
  XeroAccountResponse,
  XeroConnectionStatusResponse,
  Schedule,
  CreateScheduleRequest,
  UpdateSchedulePartialRequest,
  PostJournalRequest,
  PostJournalResponse,
  VoidScheduleResponse,
} from './types';

// API base URL - must be set in Vercel env for production; localhost always uses :8080
function getApiBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:8080'; // local dev: always backend on 8080
  }
  return process.env.NEXT_PUBLIC_API_URL || '';
}

const API_BASE_URL = typeof window !== 'undefined' ? getApiBaseUrl() : (process.env.NEXT_PUBLIC_API_URL || '');

if (!API_BASE_URL && typeof window !== 'undefined') {
  console.error('NEXT_PUBLIC_API_URL is not set! Set it in Vercel env for production.');
}

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

type CachedItem<T> = {
  timestamp: number;
  data: T;
};

const getCacheKey = (key: string, tenantId?: string) =>
  tenantId ? `cache:${key}:${tenantId}` : `cache:${key}`;

const getCachedData = <T>(key: string, ttlMs: number): T | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedItem<T>;
    if (!parsed || typeof parsed.timestamp !== 'number') return null;
    if (Date.now() - parsed.timestamp > ttlMs) return null;
    return parsed.data;
  } catch {
    return null;
  }
};

const setCachedData = <T>(key: string, data: T) => {
  if (typeof window === 'undefined') return;
  try {
    const item: CachedItem<T> = { timestamp: Date.now(), data };
    sessionStorage.setItem(key, JSON.stringify(item));
  } catch {
    // Ignore cache write errors (e.g., quota)
  }
};

const clearCachedData = (key: string) => {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(key);
};

const clearTenantCaches = (tenantId: string) => {
  clearCachedData(getCacheKey('accounts', tenantId));
  clearCachedData(getCacheKey('schedules', tenantId));
  clearCachedData(getCacheKey('scheduleContacts', tenantId));
  clearCachedData(getCacheKey('settings', tenantId));
};

const getSupabaseUser = (): { id?: string; email?: string } => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem('user');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return { id: parsed?.id, email: parsed?.email };
  } catch {
    return {};
  }
};

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
  console.log(`fetchApi: ${options?.method || 'GET'} ${url}`);
  
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
    const supabaseUser = getSupabaseUser();
    if (supabaseUser.id) params.append('supabaseUserId', supabaseUser.id);
    params.append('validateTokens', validateTokens.toString());
    return fetchApi<XeroConnectionStatusResponse>(`/api/auth/xero/status?${params.toString()}`);
  },

  /**
   * Get Xero authorization URL (redirects to Xero login).
   * Backend uses default user; no query params to avoid 400.
   */
  getConnectUrl: (_userId?: number): string => {
    if (!API_BASE_URL) {
      throw new ApiError(
        'API base URL is not configured. Please set NEXT_PUBLIC_API_URL environment variable.',
        500
      );
    }
    const supabaseUser = getSupabaseUser();
    if (!supabaseUser.id) {
      throw new ApiError('Missing Supabase user session. Please log in first.', 401);
    }
    const params = new URLSearchParams();
    if (supabaseUser.id) params.append('supabaseUserId', supabaseUser.id);
    if (supabaseUser.email) params.append('email', supabaseUser.email);
    const query = params.toString();
    return query
      ? `${API_BASE_URL}/api/auth/xero/connect?${query}`
      : `${API_BASE_URL}/api/auth/xero/connect`;
  },

  /**
   * Disconnect from Xero (delete connection)
   */
  disconnect: async (tenantId: string): Promise<{ success: boolean; message: string }> => {
    const supabaseUser = getSupabaseUser();
    const params = new URLSearchParams();
    params.append('tenantId', tenantId);
    if (supabaseUser.id) params.append('supabaseUserId', supabaseUser.id);
    const result = await fetchApi<{ success: boolean; message: string }>(
      `/api/auth/xero/disconnect?${params.toString()}`,
      {
        method: 'DELETE',
      }
    );
    clearTenantCaches(tenantId);
    return result;
  },
};

// Xero Data API
export const xeroApi = {
  /**
   * Get accounts (Chart of Accounts) for a tenant
   */
  getAccounts: async (tenantId: string): Promise<XeroAccountResponse> => {
    const cacheKey = getCacheKey('accounts', tenantId);
    const cached = getCachedData<XeroAccountResponse>(cacheKey, DEFAULT_CACHE_TTL_MS);
    if (cached) return cached;
    const data = await fetchApi<XeroAccountResponse>(`/api/xero/accounts?tenantId=${encodeURIComponent(tenantId)}`);
    setCachedData(cacheKey, data);
    return data;
  },

  /**
   * Get invoices for a tenant
   */
  getInvoices: async (tenantId: string) => {
    return fetchApi(`/api/xero/invoices?tenantId=${encodeURIComponent(tenantId)}`);
  },

  /**
   * Get balance sheet as of a date for Xero reconciliation
   */
  getBalanceSheet: async (tenantId: string, date: string) => {
    return fetchApi(
      `/api/xero/balance-sheet?tenantId=${encodeURIComponent(tenantId)}&date=${encodeURIComponent(date)}`
    );
  },
};

// Schedule API
export const scheduleApi = {
  /**
   * Create a new schedule
   */
  createSchedule: async (request: CreateScheduleRequest): Promise<Schedule> => {
    const result = await fetchApi<Schedule>('/api/schedules', {
      method: 'POST',
      body: JSON.stringify(request),
    });
    if (request.tenantId) {
      clearCachedData(getCacheKey('schedules', request.tenantId));
      clearCachedData(getCacheKey('scheduleContacts', request.tenantId));
    }
    return result;
  },

  /**
   * Get all schedules for a tenant
   * @param includeVoided when true, includes voided schedules (default false for Register/Analytics)
   */
  getSchedules: async (tenantId: string, includeVoided = false): Promise<{ schedules: Schedule[]; count: number }> => {
    const cacheKey = getCacheKey('schedules', tenantId) + (includeVoided ? ':voided' : '');
    const cached = getCachedData<{ schedules: Schedule[]; count: number }>(cacheKey, DEFAULT_CACHE_TTL_MS);
    if (cached) return cached;
    const data = await fetchApi<{ schedules: Schedule[]; count: number }>(
      `/api/schedules?tenantId=${encodeURIComponent(tenantId)}&includeVoided=${includeVoided}`
    );
    setCachedData(cacheKey, data);
    return data;
  },

  /**
   * Void a schedule (simple - no Xero journal voiding).
   * @deprecated Use voidScheduleWithJournals instead
   */
  voidSchedule: async (scheduleId: number): Promise<Schedule> => {
    const result = await fetchApi<Schedule>(`/api/schedules/${scheduleId}/void`, {
      method: 'POST',
    });
    if (result.tenantId) {
      clearCachedData(getCacheKey('schedules', result.tenantId));
      clearCachedData(getCacheKey('schedules', result.tenantId) + ':voided');
    }
    return result;
  },

  /**
   * Void a schedule and its posted journals in Xero.
   * 
   * This method:
   * 1. Checks all posted journals can be voided (period not locked in Xero)
   * 2. If any period is locked, returns error without voiding anything
   * 3. Voids all posted journals in Xero
   * 4. Marks the schedule as voided in our database
   */
  voidScheduleWithJournals: async (scheduleId: number, tenantId: string): Promise<VoidScheduleResponse> => {
    const result = await fetchApi<VoidScheduleResponse>(
      `/api/schedules/${scheduleId}/void-with-journals?tenantId=${encodeURIComponent(tenantId)}`,
      { method: 'POST' }
    );
    if (result.schedule?.tenantId) {
      clearCachedData(getCacheKey('schedules', result.schedule.tenantId));
      clearCachedData(getCacheKey('schedules', result.schedule.tenantId) + ':voided');
    }
    return result;
  },

  /**
   * Get distinct contact names for autocomplete
   */
  getContactNames: async (tenantId: string): Promise<{ contactNames: string[] }> => {
    const cacheKey = getCacheKey('scheduleContacts', tenantId);
    const cached = getCachedData<{ contactNames: string[] }>(cacheKey, DEFAULT_CACHE_TTL_MS);
    if (cached) return cached;
    const data = await fetchApi<{ contactNames: string[] }>(
      `/api/schedules/contacts?tenantId=${encodeURIComponent(tenantId)}`
    );
    setCachedData(cacheKey, data);
    return data;
  },

  /**
   * Get a specific schedule by ID
   */
  getSchedule: async (id: number): Promise<Schedule> => {
    return fetchApi<Schedule>(`/api/schedules/${id}`);
  },

  /**
   * Fully recognise (write off) remaining balance in one journal entry on the given date.
   * Posts to Xero and returns the updated schedule.
   */
  fullyRecognise: async (scheduleId: number, tenantId: string, writeOffDate: string): Promise<Schedule> => {
    const result = await fetchApi<Schedule>(
      `/api/schedules/${scheduleId}/fully-recognise?tenantId=${encodeURIComponent(tenantId)}&writeOffDate=${encodeURIComponent(writeOffDate)}`,
      { method: 'POST' }
    );
    if (result.tenantId) {
      clearCachedData(getCacheKey('schedules', result.tenantId));
      clearCachedData(getCacheKey('schedules', result.tenantId) + ':voided');
    }
    return result;
  },

  /**
   * Partial update: only contact, invoice reference, and description.
   * Use when at least one journal has been posted.
   */
  updateSchedulePartial: async (scheduleId: number, tenantId: string, request: UpdateSchedulePartialRequest): Promise<Schedule> => {
    const result = await fetchApi<Schedule>(
      `/api/schedules/${scheduleId}?tenantId=${encodeURIComponent(tenantId)}`,
      { method: 'PATCH', body: JSON.stringify(request) }
    );
    if (result.tenantId) {
      clearCachedData(getCacheKey('schedules', result.tenantId));
      clearCachedData(getCacheKey('schedules', result.tenantId) + ':voided');
    }
    return result;
  },

  /**
   * Full update: replace schedule and regenerate journal entries.
   * Only allowed when no journal has been posted.
   */
  updateScheduleFull: async (scheduleId: number, tenantId: string, request: CreateScheduleRequest): Promise<Schedule> => {
    const result = await fetchApi<Schedule>(
      `/api/schedules/${scheduleId}?tenantId=${encodeURIComponent(tenantId)}`,
      { method: 'PUT', body: JSON.stringify(request) }
    );
    if (result.tenantId) {
      clearCachedData(getCacheKey('schedules', result.tenantId));
      clearCachedData(getCacheKey('schedules', result.tenantId) + ':voided');
    }
    return result;
  },
};

// Journal API
export const journalApi = {
  /**
   * Post a journal entry to Xero
   */
  postJournal: async (request: PostJournalRequest): Promise<PostJournalResponse> => {
    const result = await fetchApi<PostJournalResponse>('/api/journals', {
      method: 'POST',
      body: JSON.stringify(request),
    });
    if (request.tenantId) {
      clearCachedData(getCacheKey('schedules', request.tenantId));
    }
    return result;
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

export type UserProfile = {
  id: number;
  email: string;
  displayName?: string | null;
  role?: string | null;
  lastLogin?: string | null;
  createdAt: string;
};

// Users API
export const usersApi = {
  /**
   * Get current user profile (display name, email, role, last login).
   * Uses sessionStorage cache (5 min) to reduce latency.
   */
  getProfile: async (): Promise<UserProfile | null> => {
    const supabaseUser = getSupabaseUser();
    if (!supabaseUser.id) return null;
    const cacheKey = getCacheKey('userProfile', supabaseUser.id);
    const cached = getCachedData<UserProfile>(cacheKey, DEFAULT_CACHE_TTL_MS);
    if (cached) return cached;
    try {
      const data = await fetchApi<UserProfile>(
        `/api/users/profile?supabaseUserId=${encodeURIComponent(supabaseUser.id)}`
      );
      setCachedData(cacheKey, data);
      return data;
    } catch {
      return null;
    }
  },

  /**
   * Record user activity (login). Updates last_login and display_name in DB.
   * Call on every login/session load - does not depend on Supabase Admin API.
   */
  recordActivity: async (sessionUser: {
    id: string;
    email?: string | null;
    user_metadata?: { full_name?: string; name?: string } | null;
  }) => {
    const displayName =
      sessionUser.user_metadata?.full_name ?? sessionUser.user_metadata?.name ?? null;
    return fetchApi<{ ok: boolean }>('/api/users/activity', {
      method: 'POST',
      body: JSON.stringify({
        supabaseUserId: sessionUser.id,
        email: sessionUser.email ?? null,
        displayName,
      }),
    });
  },

  /**
   * Sync users from Supabase Auth into the backend users table.
   * Pass session user to enrich display_name and last_login when Admin API returns null.
   */
  syncSupabase: async (sessionUser?: { id?: string; user_metadata?: { full_name?: string; name?: string } }) => {
    const body = sessionUser?.id
      ? {
          supabaseUserId: sessionUser.id,
          displayName: sessionUser.user_metadata?.full_name ?? sessionUser.user_metadata?.name ?? null,
        }
      : undefined;
    return fetchApi<{ fetched: number; upserted: number; deleted: number }>(
      '/api/users/sync-supabase',
      { method: 'POST', body: body ? JSON.stringify(body) : '{}' }
    );
  },

  /**
   * Get users who have access to the entity (tenant).
   */
  getByTenant: async (tenantId: string) => {
    if (!tenantId || tenantId === 'null' || tenantId === 'undefined') {
      return { users: [], count: 0 };
    }
    return fetchApi<{ users: { id: number; email: string; role?: string; lastLogin?: string; createdAt: string }[]; count: number }>(
      `/api/users/by-tenant?tenantId=${encodeURIComponent(tenantId)}`
    );
  },
};

// Settings API
export const settingsApi = {
  /**
   * Get tenant settings (default accounts)
   */
  getSettings: async (tenantId: string): Promise<{ prepaymentAccount: string; unearnedAccount: string }> => {
    const cacheKey = getCacheKey('settings', tenantId);
    const cached = getCachedData<{ prepaymentAccount: string; unearnedAccount: string }>(cacheKey, DEFAULT_CACHE_TTL_MS);
    if (cached) return cached;
    const data = await fetchApi<{ prepaymentAccount: string; unearnedAccount: string }>(
      `/api/settings?tenantId=${encodeURIComponent(tenantId)}`
    );
    setCachedData(cacheKey, data);
    return data;
  },

  /**
   * Save tenant settings (default accounts)
   */
  saveSettings: async (tenantId: string, settings: { prepaymentAccount: string; unearnedAccount: string }): Promise<{ prepaymentAccount: string; unearnedAccount: string }> => {
    const result = await fetchApi<{ prepaymentAccount: string; unearnedAccount: string }>(
      `/api/settings?tenantId=${encodeURIComponent(tenantId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(settings),
      }
    );
    clearCachedData(getCacheKey('settings', tenantId));
    return result;
  },
};

export { ApiError };

