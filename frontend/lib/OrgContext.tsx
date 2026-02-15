'use client';

import type { XeroConnection } from './types';

const CACHE_KEY = 'xero_connections_cache';

interface CachedConnections {
  data: XeroConnection[];
  timestamp: number;
}

/**
 * Get cached connections from sessionStorage.
 * This uses the same cache key as DashboardLayout.
 */
function getCachedConnections(): CachedConnections | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.error('Error reading connections cache:', e);
  }
  return null;
}

/**
 * Get the timezone for a specific tenant from the cached connections.
 * Falls back to null if not found.
 */
export function getOrgTimezone(tenantId: string | null | undefined): string | null {
  if (!tenantId) return null;
  
  const cached = getCachedConnections();
  if (!cached || !cached.data) return null;
  
  const connection = cached.data.find(c => 
    c.tenantId === tenantId || c.tenantId.toLowerCase() === tenantId.toLowerCase()
  );
  
  return connection?.timezone || null;
}

/**
 * Get the country code for a specific tenant from the cached connections.
 */
export function getOrgCountryCode(tenantId: string | null | undefined): string | null {
  if (!tenantId) return null;
  
  const cached = getCachedConnections();
  if (!cached || !cached.data) return null;
  
  const connection = cached.data.find(c => 
    c.tenantId === tenantId || c.tenantId.toLowerCase() === tenantId.toLowerCase()
  );
  
  return connection?.countryCode || null;
}

/**
 * Get the base currency for a specific tenant from the cached connections.
 */
export function getOrgCurrency(tenantId: string | null | undefined): string | null {
  if (!tenantId) return null;
  
  const cached = getCachedConnections();
  if (!cached || !cached.data) return null;
  
  const connection = cached.data.find(c => 
    c.tenantId === tenantId || c.tenantId.toLowerCase() === tenantId.toLowerCase()
  );
  
  return connection?.baseCurrency || null;
}

/**
 * Get the full connection object for a specific tenant from the cached connections.
 */
export function getOrgConnection(tenantId: string | null | undefined): XeroConnection | null {
  if (!tenantId) return null;
  
  const cached = getCachedConnections();
  if (!cached || !cached.data) return null;
  
  return cached.data.find(c => 
    c.tenantId === tenantId || c.tenantId.toLowerCase() === tenantId.toLowerCase()
  ) || null;
}
