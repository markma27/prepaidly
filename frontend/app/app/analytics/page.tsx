'use client';

import { Suspense, useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { scheduleApi, syncApi, xeroApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import type { Schedule, XeroAccount } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import DashboardLayout from '@/components/DashboardLayout';
import Skeleton from '@/components/Skeleton';

type TabType = 'prepayment' | 'unearned';

function AnalyticsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [accounts, setAccounts] = useState<XeroAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabType>('prepayment');

  useEffect(() => {
    const tenantIdParam = searchParams.get('tenantId');
    if (tenantIdParam) {
      setTenantId(tenantIdParam);
      const refreshAndLoad = async () => {
        try {
          await syncApi.refreshAll();
        } catch (err) {
          console.warn('Token refresh failed (non-critical):', err);
        }
        await Promise.all([
          loadSchedules(tenantIdParam),
          loadAccounts(tenantIdParam),
        ]);
      };
      refreshAndLoad();
    } else {
      setError('Missing Tenant ID');
      setLoading(false);
    }
  }, [searchParams]);

  const loadSchedules = async (tid: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await scheduleApi.getSchedules(tid);
      setSchedules(response.schedules);
    } catch (err: any) {
      console.error('Error loading schedules:', err);
      setError(err.message || 'Failed to load schedules');
    } finally {
      setLoading(false);
    }
  };

  const loadAccounts = async (tid: string) => {
    try {
      const response = await xeroApi.getAccounts(tid);
      setAccounts(response.accounts || []);
    } catch (err: any) {
      console.error('Error loading accounts:', err);
    }
  };

  const accountMap = useMemo(() => {
    const map = new Map<string, string>();
    accounts.forEach((account) => {
      if (account.code) {
        map.set(account.code, account.name);
      }
    });
    return map;
  }, [accounts]);

  const getAccountName = (code: string | undefined): string => {
    if (!code) return '';
    return accountMap.get(code) || '';
  };

  // 12 months starting from current month
  const monthColumns = useMemo(() => {
    const cols: { key: string; label: string; yearMonth: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      cols.push({ key: yearMonth, label, yearMonth });
    }
    return cols;
  }, []);

  const filteredSchedules = useMemo(() => {
    const type = activeTab === 'prepayment' ? 'PREPAID' : 'UNEARNED';
    return schedules.filter((s) => s.type === type);
  }, [schedules, activeTab]);

  // Build amount-by-month map for a schedule from journal entries
  const getAmountByMonth = (schedule: Schedule): Map<string, number> => {
    const map = new Map<string, number>();
    if (!schedule.journalEntries) return map;
    schedule.journalEntries.forEach((je) => {
      const d = new Date(je.periodDate);
      const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      map.set(yearMonth, je.amount);
    });
    return map;
  };

  const handleRowClick = (scheduleId: number) => {
    router.push(`/app/schedules/${scheduleId}?tenantId=${tenantId}`);
  };

  const getAccountCodeAndName = (schedule: Schedule): string => {
    if (schedule.type === 'PREPAID') {
      const code = schedule.expenseAcctCode || '';
      const name = getAccountName(schedule.expenseAcctCode);
return name ? `[${code}] ${name}` : code || '-';
  }
  const code = schedule.revenueAcctCode || '';
  const name = getAccountName(schedule.revenueAcctCode);
  return name ? `[${code}] ${name}` : code || '-';
  };

  // Totals per month for the current tab's schedules
  const monthTotals = useMemo(() => {
    const totals = new Map<string, number>();
    monthColumns.forEach((col) => totals.set(col.yearMonth, 0));
    filteredSchedules.forEach((schedule) => {
      const amountByMonth = getAmountByMonth(schedule);
      amountByMonth.forEach((amount, yearMonth) => {
        totals.set(yearMonth, (totals.get(yearMonth) ?? 0) + amount);
      });
    });
    return totals;
  }, [filteredSchedules, monthColumns]);

  // Remaining unamortised balance at the start of each month (totalAmount minus amounts for periods before that month)
  const getRemainingBalanceByMonth = (schedule: Schedule): Map<string, number> => {
    const map = new Map<string, number>();
    const total = schedule.totalAmount ?? 0;
    const entries = schedule.journalEntries ?? [];
    monthColumns.forEach((col) => {
      const cutoff = col.yearMonth; // e.g. "2025-02-01"
      const recognisedBefore = entries
        .filter((je) => je.periodDate < cutoff)
        .reduce((sum, je) => sum + (je.amount ?? 0), 0);
      const remaining = Math.max(0, total - recognisedBefore);
      map.set(col.yearMonth, remaining);
    });
    return map;
  };

  // Totals of remaining balance per month (for the second table footer)
  const balanceTotalsByMonth = useMemo(() => {
    const totals = new Map<string, number>();
    monthColumns.forEach((col) => totals.set(col.yearMonth, 0));
    filteredSchedules.forEach((schedule) => {
      const balanceByMonth = getRemainingBalanceByMonth(schedule);
      balanceByMonth.forEach((balance, yearMonth) => {
        totals.set(yearMonth, (totals.get(yearMonth) ?? 0) + balance);
      });
    });
    return totals;
  }, [filteredSchedules, monthColumns]);

  if (!tenantId) {
    return (
      <div className="container mx-auto p-8">
        <LoadingSpinner message="Loading..." />
      </div>
    );
  }

  return (
    <DashboardLayout tenantId={tenantId}>
      {loading ? (
        <div className="max-w-[1800px] mx-auto p-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-4">
              <Skeleton className="h-5 w-48" variant="text" />
            </div>
            <div className="p-6">
              <Skeleton className="h-10 w-full mb-4" variant="rect" />
              <Skeleton className="h-64 w-full" variant="rect" />
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-[1800px] mx-auto p-6">
          {error && (
            <ErrorMessage message={error} onDismiss={() => setError(null)} />
          )}

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-4">
              <div className="flex justify-between items-start gap-4">
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-gray-900">
                    Analytics
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Monthly amounts to be posted by contact and account
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5">
              {/* Tabs */}
              <div className="flex gap-1 mb-6 border-b border-gray-200">
                <button
                  onClick={() => setActiveTab('prepayment')}
                  className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                    activeTab === 'prepayment'
                      ? 'bg-[#6d69ff] text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Prepayment
                </button>
                <button
                  onClick={() => setActiveTab('unearned')}
                  className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                    activeTab === 'unearned'
                      ? 'bg-[#6d69ff] text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Unearned Revenue
                </button>
              </div>

              {/* Data table */}
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full min-w-[800px] text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 whitespace-nowrap">
                        Contact name
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 whitespace-nowrap">
                        Account code and name
                      </th>
                      {monthColumns.map((col) => (
                        <th
                          key={col.key}
                          className="text-right py-3 px-3 font-semibold text-gray-700 whitespace-nowrap"
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSchedules.length === 0 ? (
                      <tr>
                        <td
                          colSpan={2 + monthColumns.length}
                          className="py-8 text-center text-gray-500"
                        >
                          No {activeTab === 'prepayment' ? 'prepayment' : 'unearned revenue'}{' '}
                          schedules found.
                        </td>
                      </tr>
                    ) : (
                      filteredSchedules.map((schedule) => {
                        const amountByMonth = getAmountByMonth(schedule);
                        return (
                          <tr
                            key={schedule.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleRowClick(schedule.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleRowClick(schedule.id);
                              }
                            }}
                            className="border-b border-gray-100 hover:bg-gray-50/50 cursor-pointer"
                          >
                            <td className="py-2.5 px-4 text-gray-900 whitespace-nowrap">
                              {schedule.contactName || '-'}
                            </td>
                            <td className="py-2.5 px-4 text-gray-700 whitespace-nowrap">
                              {getAccountCodeAndName(schedule)}
                            </td>
                            {monthColumns.map((col) => {
                              const amount = amountByMonth.get(col.yearMonth);
                              return (
                                <td
                                  key={col.key}
                                  className="py-2.5 px-3 text-right text-gray-700 whitespace-nowrap tabular-nums"
                                >
                                  {amount != null && amount !== 0
                                    ? formatCurrency(amount)
                                    : '-'}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {filteredSchedules.length > 0 && (
                    <tfoot>
                      <tr className="bg-gray-100 border-t-2 border-gray-200 font-semibold">
                        <td className="py-3 px-4 text-gray-900 whitespace-nowrap" colSpan={2}>
                          Total
                        </td>
                        {monthColumns.map((col) => {
                          const total = monthTotals.get(col.yearMonth) ?? 0;
                          return (
                            <td
                              key={col.key}
                              className="py-3 px-3 text-right text-gray-900 whitespace-nowrap tabular-nums"
                            >
                              {total !== 0 ? formatCurrency(total) : '-'}
                            </td>
                          );
                        })}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Remaining balance table */}
              <div className="mt-8">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">
                  Remaining Balance
                </h4>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full min-w-[800px] text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700 whitespace-nowrap">
                          Contact name
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700 whitespace-nowrap">
                          Account code and name
                        </th>
                        {monthColumns.map((col) => (
                          <th
                            key={col.key}
                            className="text-right py-3 px-3 font-semibold text-gray-700 whitespace-nowrap"
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSchedules.length === 0 ? (
                        <tr>
                          <td
                            colSpan={2 + monthColumns.length}
                            className="py-8 text-center text-gray-500"
                          >
                            No {activeTab === 'prepayment' ? 'prepayment' : 'unearned revenue'}{' '}
                            schedules found.
                          </td>
                        </tr>
                      ) : (
                        filteredSchedules.map((schedule) => {
                          const balanceByMonth = getRemainingBalanceByMonth(schedule);
                          return (
                            <tr
                              key={schedule.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => handleRowClick(schedule.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  handleRowClick(schedule.id);
                                }
                              }}
                              className="border-b border-gray-100 hover:bg-gray-50/50 cursor-pointer"
                            >
                              <td className="py-2.5 px-4 text-gray-900 whitespace-nowrap">
                                {schedule.contactName || '-'}
                              </td>
                              <td className="py-2.5 px-4 text-gray-700 whitespace-nowrap">
                                {getAccountCodeAndName(schedule)}
                              </td>
                              {monthColumns.map((col) => {
                                const balance = balanceByMonth.get(col.yearMonth);
                                return (
                                  <td
                                    key={col.key}
                                    className="py-2.5 px-3 text-right text-gray-700 whitespace-nowrap tabular-nums"
                                  >
                                    {balance != null && balance > 0
                                      ? formatCurrency(balance)
                                      : '-'}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {filteredSchedules.length > 0 && (
                      <tfoot>
                        <tr className="bg-gray-100 border-t-2 border-gray-200 font-semibold">
                          <td className="py-3 px-4 text-gray-900 whitespace-nowrap" colSpan={2}>
                            Total
                          </td>
                          {monthColumns.map((col) => {
                            const total = balanceTotalsByMonth.get(col.yearMonth) ?? 0;
                            return (
                              <td
                                key={col.key}
                                className="py-3 px-3 text-right text-gray-900 whitespace-nowrap tabular-nums"
                              >
                                {total !== 0 ? formatCurrency(total) : '-'}
                              </td>
                            );
                          })}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-[1800px] mx-auto p-6">
          <LoadingSpinner message="Loading..." />
        </div>
      }
    >
      <AnalyticsPageContent />
    </Suspense>
  );
}
