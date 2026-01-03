'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { xeroAuthApi } from '@/lib/api';
import type { XeroConnectionStatusResponse } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { createClient } from '@/lib/supabase/client';
import { 
  Link2, 
  CheckCircle2, 
  ExternalLink, 
  Trash2, 
  RefreshCw,
  Plus,
  Sparkles
} from 'lucide-react';

export default function AppPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<XeroConnectionStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is logged in using Supabase Auth
    checkAuthAndLoadData();
  }, [router]);

  const checkAuthAndLoadData = async () => {
    try {
      const supabase = createClient();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        // User not logged in, redirect to login
        router.push('/auth/login');
        return;
      }

      // Store user info in sessionStorage for backward compatibility
      if (typeof window !== 'undefined' && session.user) {
        sessionStorage.setItem('user', JSON.stringify({
          id: session.user.id,
          email: session.user.email,
        }));
      }

      // User is authenticated, load connection status
      checkConnectionStatus();
    } catch (err) {
      console.error('Error checking auth:', err);
      router.push('/auth/login');
    }
  };

  const checkConnectionStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get user email from Supabase session (stored in sessionStorage for backward compatibility)
      // Note: The backend API now returns all connections, so userId is optional
      const userStr = typeof window !== 'undefined' ? sessionStorage.getItem('user') : null;
      let userId: number | undefined;
      
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          // Backend uses numeric IDs, but we can pass undefined since API returns all connections
          // If needed in the future, we can look up user by email to get backend user ID
          userId = undefined; // API now returns all connections regardless of userId
        } catch (e) {
          console.error('Error parsing user from sessionStorage:', e);
        }
      }

      console.log('Fetching connection status from API (returns all connections)');
      const status = await xeroAuthApi.getStatus(userId);
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
    try {
      // Get user ID from sessionStorage
      const userStr = typeof window !== 'undefined' ? sessionStorage.getItem('user') : null;
      let userId: number | undefined;
      
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          // Note: Supabase user.id is a UUID string, but backend may expect numeric ID
          // For now, we'll pass undefined to let backend handle user identification
          // If backend needs numeric ID, it should be looked up by email
          userId = undefined; // API now works without userId
        } catch (e) {
          console.error('Error parsing user from sessionStorage:', e);
        }
      }
      
      // Get the connect URL
      const connectUrl = xeroAuthApi.getConnectUrl(userId);
      
      // Validate URL before redirecting
      if (!connectUrl || connectUrl === 'undefined' || connectUrl.includes('undefined')) {
        setError('Unable to generate connection URL. Please check your API configuration.');
        console.error('Invalid connect URL:', connectUrl);
        return;
      }
      
      console.log('Redirecting to Xero OAuth:', connectUrl);
      
      // Redirect to backend OAuth endpoint
      window.location.href = connectUrl;
    } catch (err: any) {
      console.error('Error connecting to Xero:', err);
      setError(err.message || 'Failed to connect to Xero. Please try again.');
    }
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
      
      // Clear the connections cache in sessionStorage so Dashboard will refresh
      const CACHE_KEY = 'xero_connections_cache';
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(CACHE_KEY);
        console.log('Cleared connections cache after disconnect');
        
        // Dispatch custom event to notify Dashboard to refresh (for same-tab)
        window.dispatchEvent(new Event('connections-cache-cleared'));
      }
      
      // Refresh the connection status after disconnecting
      await checkConnectionStatus();
    } catch (err: any) {
      console.error('Error disconnecting:', err);
      setError(err.message || 'Failed to disconnect from Xero');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <LoadingSpinner message="Checking connection status..." />
      </div>
    );
  }

  // Show all connections, not just connected ones, so we can debug
  const allConnections = connectionStatus?.connections || [];
  const connectedConnections = allConnections.filter(conn => conn.connected);
  const disconnectedConnections = allConnections.filter(conn => !conn.connected);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gradient-to-r from-white via-gray-50/50 to-white border-b border-gray-200/80 backdrop-blur-sm">
        <div className="px-8 py-2.5 flex items-center">
          <div className="flex items-stretch gap-3">
            <div className="p-2.5 rounded-lg bg-gradient-to-br from-[#6d69ff]/10 to-[#6d69ff]/5 flex items-center justify-center self-stretch">
              <Link2 className="w-6 h-6 text-[#6d69ff]" />
            </div>
            <div className="flex flex-col justify-center">
              <h1 className="text-xl font-bold text-gray-900 leading-tight">Connect to Xero</h1>
              <p className="text-[9px] text-gray-500 mt-0.5">Manage your Xero connections</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-8 max-w-[1440px] mx-auto">
        {error && (
          <div className="mb-6">
            <ErrorMessage 
              message={error} 
              onDismiss={() => setError(null)}
            />
          </div>
        )}

        {/* Debug info */}
        {connectionStatus && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
            <strong>Debug:</strong> Total connections: {connectionStatus.totalConnections}, 
            Connected: {connectedConnections.length}, 
            Disconnected: {disconnectedConnections.length}
          </div>
        )}

        {/* Connected Xero Files Section */}
        {allConnections.length > 0 ? (
          <div className="space-y-7">
            {/* All Connections Card - Show both connected and disconnected */}
            {allConnections.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md hover:border-gray-300">
                <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <h2 className="text-base font-bold text-gray-900">Xero Files</h2>
                    <span className="ml-auto text-xs text-gray-500 font-medium">
                      {allConnections.length} {allConnections.length === 1 ? 'connection' : 'connections'} 
                      {connectedConnections.length > 0 && ` (${connectedConnections.length} connected)`}
                    </span>
                  </div>
                </div>
                <div className="p-5">
                  <p className="text-sm text-gray-600 mb-5">
                    Select a Xero file to access its dashboard, or connect a new file.
                  </p>
                  
                  <div className="space-y-3">
                    {allConnections.map((conn, index) => (
                      <div 
                        key={index} 
                        className={`border rounded-lg p-4 transition-all duration-200 hover:shadow-sm ${
                          conn.connected 
                            ? 'border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300' 
                            : 'border-yellow-200 bg-yellow-50 hover:bg-yellow-100'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-base text-gray-900 truncate">
                                {conn.tenantName || conn.tenantId}
                              </h3>
                              {conn.connected ? (
                                <span className="flex-shrink-0 px-2 py-0.5 bg-green-50 text-green-700 rounded-md text-[10px] font-bold uppercase flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Connected
                                </span>
                              ) : (
                                <span className="flex-shrink-0 px-2 py-0.5 bg-yellow-50 text-yellow-700 rounded-md text-[10px] font-bold uppercase">
                                  Disconnected
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">{conn.message || 'Status unknown'}</p>
                            {!conn.connected && (
                              <p className="text-xs text-yellow-700 mt-1">Tenant ID: {conn.tenantId}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            {conn.connected ? (
                              <>
                                <button
                                  onClick={() => handleGoToDashboard(conn.tenantId)}
                                  className="px-4 py-2 bg-[#6d69ff] text-white rounded-lg hover:bg-[#5a56e6] transition-colors font-medium text-sm flex items-center gap-2 shadow-sm"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  Open
                                </button>
                                <button
                                  onClick={() => handleDisconnect(conn.tenantId)}
                                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm flex items-center gap-2"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Disconnect
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handleConnect()}
                                className="px-4 py-2 bg-[#6d69ff] text-white rounded-lg hover:bg-[#5a56e6] transition-colors font-medium text-sm flex items-center gap-2 shadow-sm"
                              >
                                <Link2 className="w-3.5 h-3.5" />
                                Reconnect
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Connect Another File Section */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md hover:border-gray-300">
              <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
                <h2 className="text-base font-bold text-gray-900">Connect Another Xero File</h2>
              </div>
              <div className="p-5">
                <p className="text-sm text-gray-600 mb-4">Want to connect another Xero file?</p>
                <div className="flex gap-3">
                  <button
                    onClick={handleConnect}
                    className="px-4 py-2 bg-[#6d69ff] text-white rounded-lg hover:bg-[#5a56e6] transition-colors font-medium text-sm flex items-center gap-2 shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Connect New File
                  </button>
                  <button
                    onClick={checkConnectionStatus}
                    className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh Status
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* No Connections - First Time Setup */
          <div className="space-y-7">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md hover:border-gray-300">
              <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
                <h2 className="text-base font-bold text-gray-900">Get Started</h2>
              </div>
              <div className="p-5">
                <p className="text-sm text-gray-600 mb-6">
                  Connect your Xero account to start using Prepaidly. We'll guide you through the OAuth authorization process.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-blue-800">
                    <strong>Tip:</strong> Make sure to select <strong>Demo Company</strong> for testing.
                  </p>
                </div>
                <button
                  onClick={handleConnect}
                  className="px-6 py-3 bg-[#6d69ff] text-white rounded-lg hover:bg-[#5a56e6] transition-colors font-semibold text-base shadow-sm flex items-center gap-2"
                >
                  <Link2 className="w-5 h-5" />
                  Connect to Xero
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Features Section */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md hover:border-gray-300 mt-7">
          <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#6d69ff]" />
              <h3 className="text-base font-bold text-gray-900">Features</h3>
            </div>
          </div>
          <div className="p-5">
            <ul className="space-y-2.5">
              <li className="flex items-start gap-3 text-sm text-gray-700">
                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Securely connect to your Xero Demo Company</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-gray-700">
                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Retrieve Chart of Accounts</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-gray-700">
                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Create prepaid and unearned revenue schedules</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-gray-700">
                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Automatically generate monthly amortization journal entries</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-gray-700">
                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Post journal entries to Xero</span>
              </li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
