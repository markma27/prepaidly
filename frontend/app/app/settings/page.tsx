'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { xeroApi, xeroAuthApi } from '@/lib/api';
import type { XeroAccount, XeroConnectionStatusResponse } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import DashboardLayout from '@/components/DashboardLayout';

function SettingsPageContent() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<XeroAccount[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<XeroConnectionStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);

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
      const status = await xeroAuthApi.getStatus();
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

      // Load connection status
      const status = await xeroAuthApi.getStatus();
      setConnectionStatus(status);

      // Load accounts
      const accountsResponse = await xeroApi.getAccounts(tid);
      // Filter out system accounts and archived accounts
      const filteredAccounts = accountsResponse.accounts.filter(
        (acc) => !acc.isSystemAccount && acc.status !== 'ARCHIVED'
      );
      setAccounts(filteredAccounts);
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.message || 'Failed to load accounts');
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

  const currentConnection = connectionStatus?.connections?.[0];

  return (
    <DashboardLayout tenantId={tenantId}>
      <div className="max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-dark-900">Settings</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage your Xero connection and view chart of accounts
          </p>
        </div>

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
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                  <h2 className="text-xl font-semibold">Connected to {currentConnection.tenantName}</h2>
                </div>
                <p className="text-sm text-gray-600">Tenant ID: {currentConnection.tenantId}</p>
              </div>
              <button
                onClick={() => tenantId && loadData(tenantId)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors text-sm"
              >
                Refresh
              </button>
            </div>
          </div>
        )}

        {/* Chart of Accounts */}
        <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-dark-900">Chart of Accounts</h2>
              <span className="text-sm text-gray-600">
                {accounts.length} account{accounts.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <LoadingSpinner message="Loading accounts..." />
            </div>
          ) : accounts.length === 0 ? (
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
