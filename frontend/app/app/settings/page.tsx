'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { xeroApi, xeroAuthApi, syncApi, settingsApi } from '@/lib/api';
import type { XeroAccount, XeroConnectionStatusResponse } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import DashboardLayout from '@/components/DashboardLayout';
import SettingsSkeleton from '@/components/SettingsSkeleton';
import { formatXeroTimezone, formatCountryCode, formatCurrencyCode } from '@/lib/utils';

function SettingsPageContent() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<XeroAccount[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<XeroConnectionStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [defaultPrepaymentAccount, setDefaultPrepaymentAccount] = useState<string>('');
  const [defaultUnearnedAccount, setDefaultUnearnedAccount] = useState<string>('');
  const [conversionDate, setConversionDate] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const tenantIdParam = searchParams.get('tenantId');
    
    if (tenantIdParam) {
      setTenantId(tenantIdParam);
      loadData(tenantIdParam);
    } else {
      // Try to get from connection status
      loadConnectionStatus();
    }
  }, [searchParams]);

  const loadConnectionStatus = async () => {
    try {
      // Fetch status with token validation enabled
      // This ensures tokens are validated and refreshed if needed
      const status = await xeroAuthApi.getStatus(undefined, true); // validateTokens=true
      setConnectionStatus(status);
      
      if (status.totalConnections > 0 && status.connections[0].connected) {
        const firstTenantId = status.connections[0].tenantId;
        setTenantId(firstTenantId);
        loadData(firstTenantId);
      } else {
        setError('No Xero connection found');
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Error loading connection status:', err);
      setError(err.message || 'Failed to load connection status');
      setLoading(false);
    }
  };

  const loadData = async (tid: string) => {
    try {
      setLoading(true);
      setError(null);

      // Load connection status with token validation enabled
      // This ensures tokens are validated and refreshed if needed
      const status = await xeroAuthApi.getStatus(undefined, true); // validateTokens=true
      setConnectionStatus(status);

      // Load accounts
      try {
        const accountsResponse = await xeroApi.getAccounts(tid);
        // Filter out system accounts and archived accounts
        const filteredAccounts = accountsResponse.accounts.filter(
          (acc) => !acc.isSystemAccount && acc.status !== 'ARCHIVED'
        );
        setAccounts(filteredAccounts);
        
        // Load saved default accounts from database
        try {
          const defaults = await settingsApi.getSettings(tid);
          setDefaultPrepaymentAccount(defaults.prepaymentAccount || '');
          setDefaultUnearnedAccount(defaults.unearnedAccount || '');
          setConversionDate(defaults.conversionDate || '');
        } catch (e) {
          console.error('Error loading default accounts:', e);
        }
      } catch (accountsErr: any) {
        console.error('Error loading accounts:', accountsErr);
        // Check if it's a token/connection issue
        const errorMsg = accountsErr.message || 'Failed to fetch accounts';
        if (errorMsg.includes('connection not found') || errorMsg.includes('token')) {
          setError('Xero connection issue. Please try refreshing or reconnecting to Xero.');
        } else {
          setError(`Failed to fetch accounts: ${errorMsg}`);
        }
        setAccounts([]);
      }
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.message || 'Failed to load connection status');
    } finally {
      setLoading(false);
    }
  };

  if (!tenantId) {
    return (
      <div className="container mx-auto p-8">
        <LoadingSpinner message="Loading..." />
      </div>
    );
  }

  // Find the current connection matching tenantId
  const currentConnection = connectionStatus?.connections?.find(
    conn => conn.tenantId === tenantId || conn.tenantId.toLowerCase() === tenantId?.toLowerCase()
  ) || connectionStatus?.connections?.[0];

  // Filter accounts by type
  const prepaymentAccounts = accounts.filter(acc => 
    acc.type === 'ASSET' || 
    acc.type === 'CURRENT_ASSET' || 
    acc.type === 'NONCURRENT_ASSET' ||
    acc.type === 'CURRENT' ||
    acc.type === 'NONCURRENT'
  );

  const unearnedAccounts = accounts.filter(acc => 
    acc.type === 'LIABILITY' || 
    acc.type === 'CURRENT_LIABILITY' || 
    acc.type === 'NONCURRENT_LIABILITY' ||
    acc.type === 'CURRLIAB'
  );

  // Handle account selection changes (not saved until button is clicked)
  const handlePrepaymentAccountChange = (accountCode: string) => {
    setDefaultPrepaymentAccount(accountCode);
    setSaveSuccess(false);
  };

  const handleUnearnedAccountChange = (accountCode: string) => {
    setDefaultUnearnedAccount(accountCode);
    setSaveSuccess(false);
  };

  const handleConversionDateChange = (value: string) => {
    setConversionDate(value);
    setSaveSuccess(false);
  };

  // Save default accounts and conversion date to database
  const handleSaveDefaults = async () => {
    if (!tenantId) return;
    
    setSaving(true);
    setSaveSuccess(false);
    
    try {
      await settingsApi.saveSettings(tenantId, {
        prepaymentAccount: defaultPrepaymentAccount,
        unearnedAccount: defaultUnearnedAccount,
        conversionDate: conversionDate,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error('Error saving default accounts:', err);
      setError('Failed to save default accounts');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout tenantId={tenantId}>
      {loading ? (
        <SettingsSkeleton />
      ) : (
        <div className="max-w-[1800px] mx-auto p-6">
          {error && (
            <ErrorMessage 
              message={error} 
              onDismiss={() => setError(null)}
            />
          )}

          {/* Connection Status */}
          {currentConnection && (
          <div className="bg-white shadow-sm rounded-lg p-6 mb-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center mb-2">
                  <div className={`w-3 h-3 rounded-full mr-3 ${currentConnection.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <h2 className="text-xl font-semibold">Connected to {currentConnection.tenantName}</h2>
                </div>
                <p className="text-sm text-gray-600">Tenant ID: {currentConnection.tenantId}</p>
                {!currentConnection.connected && (
                  <p className="text-sm text-red-600 mt-2">
                    ⚠️ Connection expired or invalid. Please reconnect to Xero.
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {!currentConnection.connected && (
                  <button
                    onClick={() => {
                      // Backend uses default user for OAuth; do not pass Supabase UUID (would cause 400)
                      window.location.href = xeroAuthApi.getConnectUrl(undefined);
                    }}
                    className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors text-sm font-medium"
                  >
                    Reconnect to Xero
                  </button>
                )}
                <button
                  onClick={async () => {
                    if (tenantId) {
                      // Refresh tokens and organization info, then reload data
                      try {
                        await syncApi.refreshAll();
                        // Clear the connections cache to force re-fetch with updated org info
                        if (typeof window !== 'undefined') {
                          sessionStorage.removeItem('xero_connections_cache');
                        }
                      } catch (err) {
                        console.warn('Token refresh failed:', err);
                      }
                      // Reload connection status (with token validation to get fresh data)
                      await loadConnectionStatus();
                      await loadData(tenantId);
                    }
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors text-sm"
                >
                  Refresh
                </button>
              </div>
            </div>
            
            {/* Organization Details */}
            <div className="border-t border-gray-100 pt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Organization Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Region</p>
                  <p className="text-sm font-medium text-gray-900">
                    {formatCountryCode(currentConnection.countryCode)}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Timezone</p>
                  <p className="text-sm font-medium text-gray-900">
                    {formatXeroTimezone(currentConnection.timezone)}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Currency</p>
                  <p className="text-sm font-medium text-gray-900">
                    {formatCurrencyCode(currentConnection.baseCurrency)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Default Accounts */}
        {/* Conversion Date */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-4">
            <div className="flex justify-between items-start gap-4">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-gray-900">Conversion Date</h3>
                <p className="text-xs text-gray-500 mt-1">Lock date: journals with period date on or before this date cannot be posted to Xero</p>
              </div>
              <button
                onClick={handleSaveDefaults}
                disabled={saving}
                className={`flex-shrink-0 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  saving
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : saveSuccess
                    ? 'bg-green-500 text-white'
                    : 'bg-[#6d69ff] text-white hover:bg-[#5a56e6]'
                }`}
              >
                {saving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save'}
              </button>
            </div>
          </div>
          <div className="p-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Conversion Date
              </label>
              <input
                type="date"
                value={conversionDate}
                onChange={(e) => handleConversionDateChange(e.target.value)}
                className="w-full max-w-xs px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6d69ff] focus:border-transparent text-sm text-gray-900"
              />
              <p className="text-xs text-gray-500 mt-1.5">Leave empty to allow posting all journals. Set a date to lock pre-conversion periods from posting.</p>
            </div>
          </div>
        </div>

        {/* Default Accounts */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-4">
            <div className="flex justify-between items-start gap-4">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-gray-900">Default Accounts</h3>
                <p className="text-xs text-gray-500 mt-1">Set default accounts for new schedules</p>
              </div>
              <button
                onClick={handleSaveDefaults}
                disabled={saving}
                className={`flex-shrink-0 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  saving
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : saveSuccess
                    ? 'bg-green-500 text-white'
                    : 'bg-[#6d69ff] text-white hover:bg-[#5a56e6]'
                }`}
              >
                {saving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save'}
              </button>
            </div>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Default Prepayment Asset Account */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Prepayment Asset Account
                </label>
                <select
                  value={defaultPrepaymentAccount}
                  onChange={(e) => handlePrepaymentAccountChange(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6d69ff] focus:border-transparent text-sm text-gray-900"
                >
                  <option value="">Select account...</option>
                  {prepaymentAccounts.map((account) => (
                    <option key={account.accountID} value={account.code}>
                      {account.code} - {account.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1.5">Used as Dr account for prepayment schedule</p>
              </div>

              {/* Default Unearned Revenue Liability Account */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Unearned Revenue Liability Account
                </label>
                <select
                  value={defaultUnearnedAccount}
                  onChange={(e) => handleUnearnedAccountChange(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6d69ff] focus:border-transparent text-sm text-gray-900"
                >
                  <option value="">Select account...</option>
                  {unearnedAccounts.map((account) => (
                    <option key={account.accountID} value={account.code}>
                      {account.code} - {account.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1.5">Used as Cr account for unearned revenue schedules</p>
              </div>
            </div>
          </div>
        </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto p-8">
        <LoadingSpinner message="Loading..." />
      </div>
    }>
      <SettingsPageContent />
    </Suspense>
  );
}
