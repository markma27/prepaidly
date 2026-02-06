'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { xeroApi, xeroAuthApi, syncApi, settingsApi } from '@/lib/api';
import type { XeroAccount, XeroConnectionStatusResponse } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import DashboardLayout from '@/components/DashboardLayout';
import SettingsSkeleton from '@/components/SettingsSkeleton';

function SettingsPageContent() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<XeroAccount[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<XeroConnectionStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [defaultPrepaymentAccount, setDefaultPrepaymentAccount] = useState<string>('');
  const [defaultUnearnedAccount, setDefaultUnearnedAccount] = useState<string>('');
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
      // Auto-refresh all tokens before checking status
      // This ensures tokens are fresh even if they expired (30 min expiry)
      try {
        console.log('Refreshing all tokens before checking status...');
        await syncApi.refreshAll();
        console.log('Token refresh completed');
      } catch (err) {
        // Log error but continue - status check will attempt to refresh tokens if needed
        console.warn('Token refresh failed, will attempt refresh during status check:', err);
      }

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

      // Auto-refresh all tokens before checking status
      // This ensures tokens are fresh even if they expired (30 min expiry)
      try {
        console.log('Refreshing all tokens before loading data...');
        await syncApi.refreshAll();
        console.log('Token refresh completed');
      } catch (err) {
        // Log error but continue - status check will attempt to refresh tokens if needed
        console.warn('Token refresh failed, will attempt refresh during status check:', err);
      }

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

  // Save default accounts to database
  const handleSaveDefaults = async () => {
    if (!tenantId) return;
    
    setSaving(true);
    setSaveSuccess(false);
    
    try {
      await settingsApi.saveSettings(tenantId, {
        prepaymentAccount: defaultPrepaymentAccount,
        unearnedAccount: defaultUnearnedAccount,
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
            <div className="flex items-center justify-between">
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
                      const userStr = typeof window !== 'undefined' ? sessionStorage.getItem('user') : null;
                      let userId: number | undefined;
                      if (userStr) {
                        try {
                          const user = JSON.parse(userStr);
                          userId = user.id;
                        } catch (e) {
                          console.error('Error parsing user:', e);
                        }
                      }
                      // Use the API helper to get the correct backend URL
                      window.location.href = xeroAuthApi.getConnectUrl(userId);
                    }}
                    className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors text-sm font-medium"
                  >
                    Reconnect to Xero
                  </button>
                )}
                <button
                  onClick={async () => {
                    if (tenantId) {
                      // Refresh tokens first, then reload data
                      try {
                        await syncApi.refreshAll();
                      } catch (err) {
                        console.warn('Token refresh failed:', err);
                      }
                      await loadData(tenantId);
                    }
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors text-sm"
                >
                  Refresh
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Default Accounts */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-gray-900">Default Accounts</h3>
                <p className="text-xs text-gray-500 mt-0.5">Set default accounts for new schedules</p>
              </div>
              <button
                onClick={handleSaveDefaults}
                disabled={saving}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Default Prepayment Asset Account */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Prepayment Asset Account
                </label>
                <select
                  value={defaultPrepaymentAccount}
                  onChange={(e) => handlePrepaymentAccountChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6d69ff] focus:border-transparent text-sm"
                >
                  <option value="">Select account...</option>
                  {prepaymentAccounts.map((account) => (
                    <option key={account.accountID} value={account.code}>
                      [{account.code}] {account.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Used as Dr account for prepayment schedule</p>
              </div>

              {/* Default Unearned Revenue Liability Account */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Unearned Revenue Liability Account
                </label>
                <select
                  value={defaultUnearnedAccount}
                  onChange={(e) => handleUnearnedAccountChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6d69ff] focus:border-transparent text-sm"
                >
                  <option value="">Select account...</option>
                  {unearnedAccounts.map((account) => (
                    <option key={account.accountID} value={account.code}>
                      [{account.code}] {account.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Used as Cr account for unearned revenue schedules</p>
              </div>
            </div>
          </div>
        </div>

        {/* Chart of Accounts */}
        <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-dark-900">Chart of Accounts</h2>
              <span className="text-sm text-gray-600">
                {accounts.length} account{accounts.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {accounts.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <p>No account data available</p>
              <button
                onClick={() => tenantId && loadData(tenantId)}
                className="mt-4 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              >
                Reload
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Account Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Account Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {accounts.map((account) => (
                    <tr key={account.accountID} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {account.code}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {account.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {account.type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            account.status === 'ACTIVE'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {account.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
