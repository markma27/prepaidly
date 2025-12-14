'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { xeroApi, xeroAuthApi } from '@/lib/api';
import type { XeroAccount, XeroConnectionStatusResponse } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';

export default function ConnectedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<XeroAccount[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<XeroConnectionStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    const success = searchParams.get('success');
    const tenantIdParam = searchParams.get('tenantId');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError(decodeURIComponent(errorParam));
      setLoading(false);
      return;
    }

    if (success === 'true' && tenantIdParam) {
      setTenantId(tenantIdParam);
      loadData(tenantIdParam);
    } else {
      // If no params, try to get from connection status
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

  const handleGoToDashboard = () => {
    if (tenantId) {
      router.push(`/app/dashboard?tenantId=${tenantId}`);
    }
  };

  const handleCreateSchedule = () => {
    if (tenantId) {
      router.push(`/app/schedules/new?tenantId=${tenantId}`);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <LoadingSpinner message="Loading account information..." />
      </div>
    );
  }

  const currentConnection = connectionStatus?.connections?.[0];

  return (
    <div className="container mx-auto p-8 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">Connection Successful</h1>

      {error && (
        <ErrorMessage 
          message={error} 
          onDismiss={() => setError(null)}
        />
      )}

      {currentConnection && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex items-center mb-4">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
            <h2 className="text-xl font-semibold">Connected to {currentConnection.tenantName}</h2>
          </div>
          <p className="text-gray-600 mb-4">Tenant ID: {currentConnection.tenantId}</p>
          
          <div className="flex gap-4 mt-6">
            <button
              onClick={handleGoToDashboard}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Go to Dashboard
            </button>
            <button
              onClick={handleCreateSchedule}
              className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              Create New Schedule
            </button>
          </div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Chart of Accounts</h2>
          <span className="text-sm text-gray-600">
            {accounts.length} account{accounts.length !== 1 ? 's' : ''}
          </span>
        </div>

        {accounts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
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
  );
}

