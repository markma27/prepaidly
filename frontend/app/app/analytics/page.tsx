'use client';

import { Suspense, useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { scheduleApi, xeroApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import type { Schedule, JournalEntry, XeroAccount } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import DashboardLayout from '@/components/DashboardLayout';
import Skeleton from '@/components/Skeleton';
import { ChevronLeft, ChevronRight, Calendar, DollarSign, FileText, RefreshCw } from 'lucide-react';

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
  // 12-month window: start year-month "YYYY-MM". Default = current month.
  const getCurrentStartYearMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };
  const [startYearMonth, setStartYearMonth] = useState<string>(() => getCurrentStartYearMonth());

  useEffect(() => {
    const tenantIdParam = searchParams.get('tenantId');
    if (tenantIdParam) {
      setTenantId(tenantIdParam);
      const loadAnalyticsData = async () => {
        await Promise.all([
          loadSchedules(tenantIdParam),
          loadAccounts(tenantIdParam),
        ]);
      };
      loadAnalyticsData();
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

  // Show '-' for zero or rounding-to-zero (avoids $0.00 from floating point)
  const formatAmountOrDash = (value: number | null | undefined): string => {
    if (value == null) return '-';
    if (Math.round(value * 100) === 0) return '-';
    return formatCurrency(value);
  };

  // 12 months starting from selected start month
  const monthColumns = useMemo(() => {
    const cols: { key: string; label: string; yearMonth: string }[] = [];
    const [y, m] = startYearMonth.split('-').map(Number);
    for (let i = 0; i < 12; i++) {
      const d = new Date(y, m - 1 + i, 1);
      const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      cols.push({ key: yearMonth, label, yearMonth });
    }
    return cols;
  }, [startYearMonth]);

  const rangeLabel = useMemo(() => {
    if (monthColumns.length === 0) return '';
    const first = monthColumns[0].label;
    const last = monthColumns[11].label;
    return `${first} – ${last}`;
  }, [monthColumns]);

  const shiftStartMonth = (delta: number) => {
    const [y, m] = startYearMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setStartYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const filteredSchedules = useMemo(() => {
    const type = activeTab === 'prepayment' ? 'PREPAID' : 'UNEARNED';
    return schedules.filter((s) => s.type === type);
  }, [schedules, activeTab]);

  // Journal entry for a given month (by periodDate); used for posted status colour
  const getJournalEntryForMonth = (schedule: Schedule, yearMonth: string): JournalEntry | undefined => {
    const monthPrefix = yearMonth.slice(0, 7);
    const entries = schedule.journalEntries ?? [];
    return entries.find((je) => je.periodDate && je.periodDate.slice(0, 7) === monthPrefix);
  };

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
      return name ? `${code} - ${name}` : code || '-';
    }
    const code = schedule.revenueAcctCode || '';
    const name = getAccountName(schedule.revenueAcctCode);
    return name ? `${code} - ${name}` : code || '-';
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

  // Remaining unamortised balance based on invoice date: show from invoice-date month, full total until amortisation starts, then end-of-month balance
  const getRemainingBalanceByMonth = (schedule: Schedule): Map<string, number> => {
    const map = new Map<string, number>();
    const total = schedule.totalAmount ?? 0;
    const entries = schedule.journalEntries ?? [];
    // First month to show balance = month of invoice date, or start date if no invoice date
    const fromDate = schedule.invoiceDate || schedule.startDate;
    const firstMonthKey = fromDate ? `${fromDate.slice(0, 7)}-01` : '';
    const startDate = schedule.startDate; // amortisation starts on this date

    monthColumns.forEach((col) => {
      // Before invoice (or start) month: no balance to show
      if (firstMonthKey && col.yearMonth < firstMonthKey) {
        map.set(col.yearMonth, 0);
        return;
      }
      // End of this column's month
      const [y, m] = col.yearMonth.split('-').map(Number);
      const lastDay = new Date(y, m, 0);
      const cutoffEnd = `${y}-${String(m).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
      // If end of month is before amortisation start: full total (not yet amortising)
      if (cutoffEnd < startDate) {
        map.set(col.yearMonth, total);
        return;
      }
      // Otherwise: remaining at end of month = total - recognised through end of month
      const recognisedThroughEndOfMonth = entries
        .filter((je) => je.periodDate <= cutoffEnd)
        .reduce((sum, je) => sum + (je.amount ?? 0), 0);
      const remaining = Math.max(0, total - recognisedThroughEndOfMonth);
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
      <div className="max-w-[1800px] mx-auto p-6">
        {error && (
          <ErrorMessage message={error} onDismiss={() => setError(null)} />
        )}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Title always visible - consistent with other pages */}
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
            {/* Tabs and date filter on same row */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('prepayment')}
                  disabled={loading}
                  className={`flex-1 min-w-[220px] whitespace-nowrap px-4 py-3 rounded-lg border-2 text-sm font-semibold transition-all duration-200 text-left ${
                    activeTab === 'prepayment'
                      ? 'border-blue-500 bg-blue-50 text-blue-600'
                      : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                  } ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 flex-shrink-0" />
                    Prepayment
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('unearned')}
                  disabled={loading}
                  className={`flex-1 min-w-[220px] whitespace-nowrap px-4 py-3 rounded-lg border-2 text-sm font-semibold transition-all duration-200 text-left ${
                    activeTab === 'unearned'
                      ? 'border-green-500 bg-green-50 text-green-600'
                      : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                  } ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 flex-shrink-0" />
                    Unearned Revenue
                  </div>
                </button>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm text-gray-600 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    Showing:
                  </span>
                  <span className="text-sm font-medium text-gray-900 min-w-[140px]">
                    {rangeLabel}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => shiftStartMonth(-1)}
                      disabled={loading}
                      className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Previous 12 months"
                      aria-label="Previous 12 months"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => shiftStartMonth(1)}
                      disabled={loading}
                      className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Next 12 months"
                      aria-label="Next 12 months"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setStartYearMonth(getCurrentStartYearMonth())}
                      disabled={loading}
                      className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Current period"
                      aria-label="Current period"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {loading ? (
              /* Skeleton tables matching actual table layout */
              <>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">
                  Monthly Amounts to Post
                </h4>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full min-w-[800px] text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700 whitespace-nowrap">
                          Contact Name
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700 whitespace-nowrap">
                          Account Code and Name
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
                      {[1, 2, 3, 4, 5].map((i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="py-2.5 px-4">
                            <Skeleton className="h-4 w-28" variant="text" />
                          </td>
                          <td className="py-2.5 px-4">
                            <Skeleton className="h-4 w-36" variant="text" />
                          </td>
                          {monthColumns.map((col) => (
                            <td key={col.key} className="py-2.5 px-3 text-right">
                              <Skeleton className="h-4 w-14 ml-auto" variant="text" />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-100 border-t-2 border-gray-200">
                        <td className="py-3 px-4" colSpan={2}>
                          <Skeleton className="h-4 w-12" variant="text" />
                        </td>
                        {monthColumns.map((col) => (
                          <td key={col.key} className="py-3 px-3 text-right">
                            <Skeleton className="h-4 w-14 ml-auto" variant="text" />
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="mt-8">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">
                    Remaining Balance at Month End
                  </h4>
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="w-full min-w-[800px] text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left py-3 px-4 font-semibold text-gray-700 whitespace-nowrap">
                            Contact Name
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700 whitespace-nowrap">
                            Account Code and Name
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
                        {[1, 2, 3, 4, 5].map((i) => (
                          <tr key={i} className="border-b border-gray-100">
                            <td className="py-2.5 px-4">
                              <Skeleton className="h-4 w-28" variant="text" />
                            </td>
                            <td className="py-2.5 px-4">
                              <Skeleton className="h-4 w-36" variant="text" />
                            </td>
                            {monthColumns.map((col) => (
                              <td key={col.key} className="py-2.5 px-3 text-right">
                                <Skeleton className="h-4 w-14 ml-auto" variant="text" />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-100 border-t-2 border-gray-200">
                          <td className="py-3 px-4" colSpan={2}>
                            <Skeleton className="h-4 w-12" variant="text" />
                          </td>
                          {monthColumns.map((col) => (
                            <td key={col.key} className="py-3 px-3 text-right">
                              <Skeleton className="h-4 w-14 ml-auto" variant="text" />
                            </td>
                          ))}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <>
              {/* Data table */}
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                Monthly Amounts to Post
              </h4>
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full min-w-[800px] text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 whitespace-nowrap">
                        Contact Name
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 whitespace-nowrap">
                        Account Code and Name
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
                              const entry = getJournalEntryForMonth(schedule, col.yearMonth);
                              const hasAmount = amount != null && Math.round(amount * 100) !== 0;
                              const statusClass =
                                hasAmount && entry
                                  ? entry.posted
                                    ? 'text-green-600'
                                    : 'text-amber-600'
                                  : 'text-gray-700';
                              return (
                                <td
                                  key={col.key}
                                  className={`py-2.5 px-3 text-right whitespace-nowrap tabular-nums ${statusClass}`}
                                >
                                  {formatAmountOrDash(amount)}
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
                              {formatAmountOrDash(monthTotals.get(col.yearMonth) ?? 0)}
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
                  Remaining Balance at Month End
                </h4>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full min-w-[800px] text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700 whitespace-nowrap">
                          Contact Name
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700 whitespace-nowrap">
                          Account Code and Name
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
                                const entry = getJournalEntryForMonth(schedule, col.yearMonth);
                                const statusClass = entry
                                  ? entry.posted
                                    ? 'text-green-600'
                                    : 'text-amber-600'
                                  : 'text-gray-700';
                                return (
                                  <td
                                    key={col.key}
                                    className={`py-2.5 px-3 text-right whitespace-nowrap tabular-nums ${statusClass}`}
                                  >
                                    {formatAmountOrDash(balance)}
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
                                {formatAmountOrDash(total)}
                              </td>
                            );
                          })}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </>
            )}
          </div>
        </div>
      </div>
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
