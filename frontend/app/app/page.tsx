'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { xeroAuthApi } from '@/lib/api';
import type { XeroConnectionStatusResponse } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';

export default function AppPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<XeroConnectionStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkConnectionStatus();
  }, []);

  const checkConnectionStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching connection status from API...');
      const status = await xeroAuthApi.getStatus();
      console.log('API Response:', JSON.stringify(status, null, 2));
      console.log('Total connections:', status?.totalConnections);
      console.log('Connections array length:', status?.connections?.length);
      console.log('Connections:', status?.connections);
      setConnectionStatus(status);
    } catch (err: any) {
      console.error('Error checking connection status:', err);
      console.error('Error details:', {
        message: err.message,
        status: err.status,
        data: err.data
      });
      setError(err.message || 'Failed to check connection status');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = () => {
    // Redirect to backend OAuth endpoint
    window.location.href = xeroAuthApi.getConnectUrl();
  };

  const handleGoToDashboard = (tenantId: string) => {
    router.push(`/app/dashboard?tenantId=${tenantId}`);
  };

  const handleDisconnect = async (tenantId: string) => {
    if (!confirm('Are you sure you want to disconnect this Xero file? This will remove the connection from Prepaidly.')) {
      return;
    }

    try {
      await xeroAuthApi.disconnect(tenantId);
      // Refresh the connection status after disconnecting
      await checkConnectionStatus();
    } catch (err: any) {
      console.error('Error disconnecting:', err);
      setError(err.message || 'Failed to disconnect from Xero');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <LoadingSpinner message="Checking connection status..." />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6 text-dark-900">Connect to Xero</h1>

      {error && (
        <ErrorMessage 
          message={error} 
          onDismiss={() => setError(null)}
        />
      )}

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        {connectionStatus && connectionStatus.connections && connectionStatus.connections.length > 0 ? (
          <div>
            <div className="flex items-center mb-4">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
              <h2 className="text-xl font-semibold">Connected Xero Files</h2>
            </div>
            
            <p className="mb-4 text-gray-700 text-sm">
              Select a connected Xero file to access its dashboard, or connect a new file.
            </p>
            
            {connectionStatus.connections.filter(conn => conn.connected).length > 0 ? (
              <div className="space-y-3 mb-6">
                {connectionStatus.connections
                  .filter(conn => conn.connected)
                  .map((conn, index) => (
                  <div key={index} className="border rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                      <p className="font-semibold text-lg">{conn.tenantName}</p>
                      <p className="text-sm text-gray-600">Tenant ID: {conn.tenantId}</p>
                      <p className="text-sm text-green-600 mt-1">{conn.message}</p>
                    </div>
                      <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                      Connected
                    </span>
                        <button
                          onClick={() => handleGoToDashboard(conn.tenantId)}
                          className="px-4 py-2 bg-primary-400 text-white rounded-lg hover:bg-primary-500 transition-colors font-medium shadow-sm"
                        >
                          Open
                        </button>
                        <button
                          onClick={() => handleDisconnect(conn.tenantId)}
                          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium shadow-sm"
                        >
                          Disconnect
                        </button>
                      </div>
                  </div>
                </div>
              ))}
            </div>
            ) : (
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  You have {connectionStatus.totalConnections} connection(s), but they are not currently active. 
                  Please refresh or reconnect.
                </p>
              </div>
            )}

            <div className="border-t pt-4">
              <p className="text-sm text-gray-600 mb-3">Want to connect another Xero file?</p>
              <div className="flex gap-4">
              <button
                  onClick={handleConnect}
                className="px-6 py-2 bg-primary-400 text-white rounded-lg hover:bg-primary-500 transition-colors font-medium shadow-sm"
              >
                  Connect New File
              </button>
              <button
                onClick={checkConnectionStatus}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              >
                Refresh Status
              </button>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <p className="mb-6 text-gray-700">
              Connect your Xero account to start using Prepaidly. We'll guide you through the OAuth authorization process.
            </p>
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-primary-800">
                <strong>Tip:</strong> Make sure to select <strong>Demo Company</strong> for testing.
              </p>
            </div>
            <button
              onClick={handleConnect}
                className="px-6 py-3 bg-primary-400 text-white rounded-lg hover:bg-primary-500 transition-colors font-semibold text-lg shadow-sm"
            >
              Connect to Xero
            </button>
          </div>
        )}
      </div>

      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="font-semibold mb-2">Features</h3>
        <ul className="list-disc list-inside space-y-1 text-gray-700 text-sm">
          <li>Securely connect to your Xero Demo Company</li>
          <li>Retrieve Chart of Accounts</li>
          <li>Create prepaid and unearned revenue schedules</li>
          <li>Automatically generate monthly amortization journal entries</li>
          <li>Post journal entries to Xero</li>
        </ul>
      </div>
    </div>
  );
}
