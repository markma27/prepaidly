import { useEffect, useRef } from 'react';
import { syncApi } from '@/lib/api';

const TOKEN_REFRESH_CACHE_KEY = 'xero_token_refresh_ts';
const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000;
const DEFAULT_INTERVAL_MS = 25 * 60 * 1000;

type UseTokenAutoRefreshOptions = {
  enabled?: boolean;
  cooldownMs?: number;
  intervalMs?: number;
};

const getLastTokenRefreshTs = (): number | null => {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(TOKEN_REFRESH_CACHE_KEY);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const setLastTokenRefreshTs = (ts: number) => {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(TOKEN_REFRESH_CACHE_KEY, String(ts));
};

export default function useTokenAutoRefresh({
  enabled = true,
  cooldownMs = DEFAULT_COOLDOWN_MS,
  intervalMs = DEFAULT_INTERVAL_MS,
}: UseTokenAutoRefreshOptions = {}) {
  const refreshInFlightRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const refreshTokensIfNeeded = async () => {
      if (refreshInFlightRef.current) return;
      const lastRefreshTs = getLastTokenRefreshTs();
      if (lastRefreshTs && Date.now() - lastRefreshTs < cooldownMs) {
        return;
      }

      refreshInFlightRef.current = true;
      try {
        await syncApi.refreshAll();
        if (!cancelled) {
          setLastTokenRefreshTs(Date.now());
        }
      } catch (err) {
        console.warn('Token refresh failed (non-critical):', err);
      } finally {
        refreshInFlightRef.current = false;
      }
    };

    refreshTokensIfNeeded();
    const intervalId = window.setInterval(() => {
      refreshTokensIfNeeded();
    }, intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [enabled, cooldownMs, intervalMs]);
}
