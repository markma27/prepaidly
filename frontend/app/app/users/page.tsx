'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { usersApi, xeroAuthApi } from '@/lib/api';
import type { UserListItem } from '@/lib/types';
import ErrorMessage from '@/components/ErrorMessage';
import DashboardLayout from '@/components/DashboardLayout';
import UsersSkeleton from '@/components/UsersSkeleton';
import { UserPlus, Shield, ShieldCheck, User, ArrowUpCircle, ArrowDownCircle, ChevronUp, ChevronDown, AlertTriangle, X } from 'lucide-react';

function formatDisplayName(user: UserListItem): string {
  if (user.displayName && user.displayName.trim()) {
    return user.displayName.trim();
  }
  const part = user.email.split('@')[0];
  if (!part) return user.email;
  return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
}

/** Format as DD MMM YYYY (e.g. 22 Feb 2026) */
function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

/** Format as DD MMM YYYY, HH:MM am/pm (e.g. 15 Mar 2026, 12:41 am) */
function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    const datePart = d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const timePart = d.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    return `${datePart}, ${timePart}`;
  } catch {
    return '—';
  }
}

/** Normalize to display role: prefer effectiveRole, fall back to backend role (SYS_ADMIN, ORG_ADMIN, ORG_USER) */
function getDisplayRole(user: UserListItem): string {
  if (user.effectiveRole) {
    if (user.effectiveRole === 'SUPER_ADMIN') return 'SUPER_ADMIN';
    if (user.effectiveRole === 'ADMIN') return 'ADMIN';
    if (user.effectiveRole === 'GENERAL_USER') return 'GENERAL_USER';
  }
  const r = user.role;
  if (r === 'SYS_ADMIN') return 'SUPER_ADMIN';
  if (r === 'ORG_ADMIN') return 'ADMIN';
  if (r === 'ORG_USER') return 'GENERAL_USER';
  return '';
}

function getRoleLabel(displayRole: string): string {
  switch (displayRole) {
    case 'SUPER_ADMIN':
      return 'Super Admin';
    case 'ADMIN':
      return 'Admin';
    case 'GENERAL_USER':
      return 'General User';
    default:
      return displayRole || '—';
  }
}

function getRoleIcon(displayRole: string) {
  switch (displayRole) {
    case 'SUPER_ADMIN':
      return <ShieldCheck className="w-4 h-4 text-amber-600" />;
    case 'ADMIN':
      return <Shield className="w-4 h-4 text-blue-600" />;
    case 'GENERAL_USER':
      return <User className="w-4 h-4 text-gray-500" />;
    default:
      return null;
  }
}

function getRoleBadgeClass(displayRole: string): string {
  switch (displayRole) {
    case 'SUPER_ADMIN':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'ADMIN':
      return 'bg-blue-50 text-blue-800 border-blue-200';
    case 'GENERAL_USER':
      return 'bg-gray-50 text-gray-700 border-gray-200';
    default:
      return 'bg-gray-50 text-gray-600 border-gray-200';
  }
}

function UsersPageContent() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [currentUserEffectiveRole, setCurrentUserEffectiveRole] = useState<string | null>(null);
  const [promotingId, setPromotingId] = useState<number | null>(null);
  const [demotingId, setDemotingId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  type UserSortKey = 'displayName' | 'email' | 'role' | 'createdAt' | 'lastLogin';
  const [sortKey, setSortKey] = useState<UserSortKey>('displayName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const ROLE_ORDER: Record<string, number> = { SUPER_ADMIN: 0, ADMIN: 1, GENERAL_USER: 2 };

  const sortedUsers = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...users].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;
      switch (sortKey) {
        case 'displayName':
          aVal = formatDisplayName(a).toLowerCase();
          bVal = formatDisplayName(b).toLowerCase();
          break;
        case 'email':
          aVal = a.email.toLowerCase();
          bVal = b.email.toLowerCase();
          break;
        case 'role':
          aVal = ROLE_ORDER[getDisplayRole(a)] ?? 99;
          bVal = ROLE_ORDER[getDisplayRole(b)] ?? 99;
          break;
        case 'createdAt':
          aVal = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          bVal = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          break;
        case 'lastLogin':
          aVal = a.lastLogin ? new Date(a.lastLogin).getTime() : 0;
          bVal = b.lastLogin ? new Date(b.lastLogin).getTime() : 0;
          break;
        default:
          return 0;
      }
      if (aVal === bVal) return 0;
      return dir * (aVal > bVal ? 1 : -1);
    });
  }, [users, sortKey, sortDir]);

  const handleSort = (column: UserSortKey) => {
    if (sortKey === column) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(column);
      setSortDir(column === 'createdAt' || column === 'lastLogin' ? 'desc' : 'asc');
    }
  };

  const SortIcon = ({ column }: { column: UserSortKey }) => {
    if (sortKey !== column) return null;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 inline ml-0.5" />
      : <ChevronDown className="w-3 h-3 inline ml-0.5" />;
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const tenantIdParam = searchParams.get('tenantId');
    if (tenantIdParam && tenantIdParam !== 'null' && tenantIdParam !== 'undefined') {
      setTenantId(tenantIdParam);
      loadUsers(tenantIdParam);
    } else {
      loadConnectionStatus();
    }
  }, [searchParams]);

  useEffect(() => {
    if (!tenantId) return;
    usersApi.getProfile(tenantId).then((p) => {
      if (p) setCurrentUserEffectiveRole(p.effectiveRole || p.role || null);
    });
  }, [tenantId]);

  const isSuperAdmin = currentUserEffectiveRole === 'SYS_ADMIN' || currentUserEffectiveRole === 'SUPER_ADMIN';
  const isAdmin = currentUserEffectiveRole === 'ORG_ADMIN' || currentUserEffectiveRole === 'ADMIN';
  const canManageUsers = isSuperAdmin || isAdmin;

  const loadConnectionStatus = async () => {
    try {
      const status = await xeroAuthApi.getStatus(undefined, true);
      if (
        status.totalConnections > 0 &&
        status.connections &&
        status.connections.length > 0 &&
        status.connections[0].connected
      ) {
        const firstTenantId = status.connections[0].tenantId;
        setTenantId(firstTenantId);
        loadUsers(firstTenantId);
      } else {
        setError('No Xero connection found. Please connect to Xero first.');
        setLoading(false);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load connection status';
      setError(message);
      setLoading(false);
    }
  };

  const loadUsers = async (tid: string) => {
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

  const handlePromoteToAdmin = async (userId: number) => {
    if (!tenantId || !canManageUsers) return;
    try {
      setPromotingId(userId);
      await usersApi.promoteToAdmin(userId, tenantId);
      await loadUsers(tenantId);
    } catch (err: any) {
      const message = err?.message || 'Failed to promote user';
      setToast(message);
    } finally {
      setPromotingId(null);
    }
  };

  const handleDemoteToUser = async (userId: number) => {
    if (!tenantId || !canManageUsers) return;
    try {
      setDemotingId(userId);
      await usersApi.demoteToUser(userId, tenantId);
      await loadUsers(tenantId);
    } catch (err: any) {
      const message = err?.message || 'Failed to demote user';
      setToast(message);
    } finally {
      setDemotingId(null);
    }
  };

  return (
    <DashboardLayout tenantId={tenantId || ''}>
      {toast && (
        <div className="fixed top-6 right-6 z-[100] max-w-sm animate-in slide-in-from-top-2 fade-in">
          <div className="flex items-start gap-3 px-4 py-3 bg-white border border-red-200 rounded-xl shadow-lg">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-800 flex-1">{toast}</p>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-gray-400 hover:text-gray-600 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      {loading || !tenantId || tenantId === 'null' || tenantId === 'undefined' ? (
        <UsersSkeleton />
      ) : (
        <div className="space-y-7 max-w-[1800px] mx-auto">
          {error && (
            <ErrorMessage message={error} onDismiss={() => setError(null)} />
          )}

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md hover:border-gray-300">
            <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Users with access
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  People who can access this entity. Display name, email, role, created date, and last login.
                </p>
              </div>
              <button
                type="button"
                disabled
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-400 bg-gray-100 border border-gray-200 rounded-lg cursor-not-allowed"
                title="Invite functionality coming soon"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Invite user
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="px-5 py-3">
                      <button type="button" onClick={() => handleSort('displayName')} className="hover:text-gray-700 transition-colors">
                        Display name<SortIcon column="displayName" />
                      </button>
                    </th>
                    <th className="px-5 py-3">
                      <button type="button" onClick={() => handleSort('email')} className="hover:text-gray-700 transition-colors">
                        Email<SortIcon column="email" />
                      </button>
                    </th>
                    <th className="px-5 py-3">
                      <button type="button" onClick={() => handleSort('role')} className="hover:text-gray-700 transition-colors">
                        Role<SortIcon column="role" />
                      </button>
                    </th>
                    <th className="px-5 py-3">
                      <button type="button" onClick={() => handleSort('createdAt')} className="hover:text-gray-700 transition-colors">
                        Created<SortIcon column="createdAt" />
                      </button>
                    </th>
                    <th className="px-5 py-3">
                      <button type="button" onClick={() => handleSort('lastLogin')} className="hover:text-gray-700 transition-colors">
                        Last login<SortIcon column="lastLogin" />
                      </button>
                    </th>
                    {canManageUsers && (
                      <th className="px-5 py-3">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedUsers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={canManageUsers ? 6 : 5}
                        className="px-5 py-12 text-center text-sm text-gray-500"
                      >
                        No users with access to this entity yet.
                      </td>
                    </tr>
                  ) : (
                    sortedUsers.map((user) => {
                      const displayRole = getDisplayRole(user);
                      return (
                        <tr
                          key={user.id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-5 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                            {formatDisplayName(user)}
                          </td>
                          <td className="px-5 py-3 text-sm text-gray-600 whitespace-nowrap">
                            {user.email}
                          </td>
                          <td className="px-5 py-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${getRoleBadgeClass(
                                displayRole
                              )}`}
                            >
                              {getRoleIcon(displayRole)}
                              {getRoleLabel(displayRole)}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-sm text-gray-500 whitespace-nowrap">
                            {formatDate(user.createdAt)}
                          </td>
                          <td className="px-5 py-3 text-sm text-gray-500 whitespace-nowrap">
                            {user.lastLogin
                              ? formatDateTime(user.lastLogin)
                              : '—'}
                          </td>
                          {canManageUsers && (
                            <td className="px-5 py-3 whitespace-nowrap text-sm">
                              <div className="flex items-center gap-2">
                                {/* Promote: SYS_ADMIN can promote anyone non-SUPER_ADMIN; ORG_ADMIN can promote GENERAL_USER */}
                                {displayRole === 'GENERAL_USER' && (isSuperAdmin || isAdmin) && (
                                  <button
                                    type="button"
                                    onClick={() => handlePromoteToAdmin(user.id)}
                                    disabled={promotingId === user.id}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[#6d69ff] bg-white border border-[#6d69ff]/30 rounded-lg hover:bg-[#6d69ff]/5 hover:border-[#6d69ff]/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <ArrowUpCircle className="w-3.5 h-3.5" />
                                    {promotingId === user.id ? 'Promoting…' : 'Promote'}
                                  </button>
                                )}
                                {displayRole === 'ADMIN' && isSuperAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => handlePromoteToAdmin(user.id)}
                                    disabled
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-gray-400 bg-gray-100 border border-gray-200 rounded-lg cursor-not-allowed"
                                    title="Already an admin"
                                  >
                                    <ArrowUpCircle className="w-3.5 h-3.5" />
                                    Promote
                                  </button>
                                )}
                                {/* Demote: SYS_ADMIN can demote anyone non-SUPER_ADMIN; ORG_ADMIN can demote ADMIN */}
                                {displayRole === 'ADMIN' && (isSuperAdmin || isAdmin) && (
                                  <button
                                    type="button"
                                    onClick={() => handleDemoteToUser(user.id)}
                                    disabled={demotingId === user.id}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-orange-600 bg-white border border-orange-300 rounded-lg hover:bg-orange-50 hover:border-orange-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <ArrowDownCircle className="w-3.5 h-3.5" />
                                    {demotingId === user.id ? 'Demoting…' : 'Demote'}
                                  </button>
                                )}
                                {displayRole === 'GENERAL_USER' && isSuperAdmin && (
                                  <button
                                    type="button"
                                    disabled
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-gray-400 bg-gray-100 border border-gray-200 rounded-lg cursor-not-allowed"
                                    title="Already a general user"
                                  >
                                    <ArrowDownCircle className="w-3.5 h-3.5" />
                                    Demote
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
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
        <div className="space-y-7 max-w-[1800px] mx-auto">
          <UsersSkeleton />
        </div>
      }
    >
      <UsersPageContent />
    </Suspense>
  );
}
