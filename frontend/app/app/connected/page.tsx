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

  // Auto-redirect to dashboard after successful connection
  useEffect(() => {
    const success = searchParams.get('success');
    if (success === 'true' && tenantId && accounts.length > 0) {
      // Small delay to show success message
      const timer = setTimeout(() => {
        router.push(`/app/dashboard?tenantId=${tenantId}`);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, tenantId, accounts.length, router]);

  const handleCreateSchedule = () => {
    if (tenantId) {
      router.push(`/app/schedules/new?tenantId=${tenantId}`);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <LoadingSpinner message="Connecting to Xero..." />
      </div>
    );
  }

  const currentConnection = connectionStatus?.connections?.[0];

  // Show success message and redirect
  if (searchParams.get('success') === 'true' && tenantId) {
    return (
      <div className="container mx-auto p-8 max-w-2xl">
        <div className="bg-white shadow rounded-lg p-8 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Connection Successful!</h1>
            {currentConnection && (
              <p className="text-gray-600">
                Connected to <span className="font-semibold">{currentConnection.tenantName}</span>
              </p>
            )}
          </div>
          
          <div className="mb-6">
            <LoadingSpinner message="Redirecting to dashboard..." />
          </div>
          
          <p className="text-sm text-gray-500">
            If you are not redirected automatically,{' '}
            <button
              onClick={handleGoToDashboard}
              className="text-primary-400 hover:text-primary-500 underline font-medium"
            >
              click here
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">Connection Status</h1>

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
              className="px-6 py-2 bg-primary-400 text-white rounded-lg hover:bg-primary-500 transition-colors font-medium shadow-sm"
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
    </div>
  );
}

