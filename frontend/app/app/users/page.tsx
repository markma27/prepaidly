'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { usersApi, xeroAuthApi } from '@/lib/api';
import type { UserListItem } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import DashboardLayout from '@/components/DashboardLayout';
import UsersSkeleton from '@/components/UsersSkeleton';
import { UserPlus } from 'lucide-react';

function formatDisplayName(email: string): string {
  const part = email.split('@')[0];
  if (!part) return email;
  return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { dateStyle: 'medium' });
  } catch {
    return '—';
  }
}

function UsersPageContent() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    const tenantIdParam = searchParams.get('tenantId');
    console.log('tenantIdParam from URL:', tenantIdParam);
    if (tenantIdParam && tenantIdParam !== 'null' && tenantIdParam !== 'undefined') {
      setTenantId(tenantIdParam);
      loadUsers(tenantIdParam);
    } else {
      loadConnectionStatus();
    }
  }, [searchParams]);

  const loadConnectionStatus = async () => {
    console.log('No tenantId in URL, checking connection status...');
    try {
      const status = await xeroAuthApi.getStatus(undefined, true);
      console.log('Connection status:', status);
      if (status.totalConnections > 0 && status.connections && status.connections.length > 0 && status.connections[0].connected) {
        const firstTenantId = status.connections[0].tenantId;
        console.log('Using first connected tenant:', firstTenantId);
        setTenantId(firstTenantId);
        loadUsers(firstTenantId);
      } else {
        setError('No Xero connection found. Please connect to Xero first.');
        setLoading(false);
      }
    } catch (err: unknown) {
      console.error('Failed to load connection status:', err);
      const message = err instanceof Error ? err.message : 'Failed to load connection status';
      setError(message);
      setLoading(false);
    }
  };

  const loadUsers = async (tid: string) => {
    console.log('Loading users for tenant:', tid);
    if (!tid || tid === 'null' || tid === 'undefined') {
      setError('No valid entity selected');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await usersApi.getByTenant(tid);
      setUsers(data.users);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load users';
      setError(message);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  if (!tenantId || tenantId === 'null' || tenantId === 'undefined') {
    return (
      <div className="container mx-auto p-8">
        <LoadingSpinner message="Loading..." />
      </div>
    );
  }

  return (
    <DashboardLayout tenantId={tenantId}>
      {loading ? (
        <UsersSkeleton />
      ) : (
        <div className="max-w-[1800px] mx-auto p-6">
          {error && (
            <ErrorMessage
              message={error}
              onDismiss={() => setError(null)}
            />
          )}

          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Users with access</h2>
                  <p className="text-sm text-gray-500 mt-0.5">People who can access this entity</p>
                </div>
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-gray-200 text-gray-500 cursor-not-allowed"
                  title="Invite functionality coming soon"
                >
                  <UserPlus className="w-4 h-4" />
                  Invite user
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Display name
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last login
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                        No users with access to this entity yet.
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50/50">
                        <td className="px-6 py-3.5 whitespace-nowrap text-sm font-medium text-gray-900">
                          {formatDisplayName(user.email)}
                        </td>
                        <td className="px-6 py-3.5 whitespace-nowrap text-sm text-gray-600">
                          {user.email}
                        </td>
                        <td className="px-6 py-3.5 whitespace-nowrap text-sm text-gray-500">
                          {user.role || '—'}
                        </td>
                        <td className="px-6 py-3.5 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(user.createdAt)}
                        </td>
                        <td className="px-6 py-3.5 whitespace-nowrap text-sm text-gray-500">
                          {user.lastLogin ? formatDate(user.lastLogin) : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default function UsersPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto p-8">
          <LoadingSpinner message="Loading..." />
        </div>
      }
    >
      <UsersPageContent />
    </Suspense>
  );
}
