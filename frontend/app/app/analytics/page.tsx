'use client';

import { Suspense, useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { scheduleApi, xeroApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { getOrgCurrency } from '@/lib/OrgContext';
import type { Schedule, JournalEntry, XeroAccount } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import DashboardLayout from '@/components/DashboardLayout';
import Skeleton from '@/components/Skeleton';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Calendar, DollarSign, FileText, RefreshCw, Download, Info } from 'lucide-react';
import * as XLSX from 'xlsx';

type TabType = 'prepayment' | 'unearned';

function AnalyticsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [accounts, setAccounts] = useState<XeroAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string>('');
  
  // Get org currency for formatting
  const orgCurrency = getOrgCurrency(tenantId) || 'USD';
  const [activeTab, setActiveTab] = useState<TabType>('prepayment');
  const [sortKey, setSortKey] = useState<string>('contactName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  // 10-month window: start year-month "YYYY-MM". Default = current month.
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

  // Show '-' for zero or rounding-to-zero (avoids $0.00 from floating point)
  const formatAmountOrDash = (value: number | null | undefined): string => {
    if (value == null) return '-';
    if (Math.round(value * 100) === 0) return '-';
    return formatCurrency(value, orgCurrency);
  };

  // 10 months starting from selected start month
  const monthColumns = useMemo(() => {
    const cols: { key: string; label: string; yearMonth: string }[] = [];
    const [y, m] = startYearMonth.split('-').map(Number);
    for (let i = 0; i < 10; i++) {
      const d = new Date(y, m - 1 + i, 1);
      const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      cols.push({ key: yearMonth, label, yearMonth });
    }
    return cols;
  }, [startYearMonth]);

  const rangeLabel = useMemo(() => {
    if (monthColumns.length === 0) return '';
    const first = monthColumns[0].label;
    const last = monthColumns[9].label;
    return `${first} – ${last}`;
  }, [monthColumns]);

  const shiftStartMonth = (delta: number) => {
    const [y, m] = startYearMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setStartYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  // Filter schedules by type first
  const typeFilteredSchedules = useMemo(() => {
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

  // Further filter to hide schedules that have no amounts in the visible 10-month window
  // AND are outside the 3-month grace period on either side of the window
  const filteredSchedules = useMemo(() => {
    const [startY, startM] = startYearMonth.split('-').map(Number);
    
    // Cutoff for past: 3 months before the start of the visible window
    const pastCutoffDate = new Date(startY, startM - 1 - 3, 1);
    const pastCutoffYearMonth = `${pastCutoffDate.getFullYear()}-${String(pastCutoffDate.getMonth() + 1).padStart(2, '0')}-01`;
    
    // Cutoff for future: 3 months after the end of the visible window (window is 10 months, so end is startM + 9)
    const futureCutoffDate = new Date(startY, startM - 1 + 10 + 3, 1);
    const futureCutoffYearMonth = `${futureCutoffDate.getFullYear()}-${String(futureCutoffDate.getMonth() + 1).padStart(2, '0')}-01`;

    return typeFilteredSchedules.filter((schedule) => {
      const amountByMonth = getAmountByMonth(schedule);
      
      // Check if schedule has any amounts in the visible 10-month window
      const hasAmountInWindow = monthColumns.some((col) => {
        const amount = amountByMonth.get(col.yearMonth);
        return amount != null && Math.round(amount * 100) !== 0;
      });

      // If it has amounts in the window, show it
      if (hasAmountInWindow) return true;

      const entries = schedule.journalEntries ?? [];
      if (entries.length === 0) {
        // No entries yet - check if invoice/start date is within 3 months after window end
        const fromDate = schedule.invoiceDate || schedule.startDate;
        if (!fromDate) return false;
        const fromYearMonth = `${fromDate.slice(0, 7)}-01`;
        return fromYearMonth < futureCutoffYearMonth;
      }

      // Find the first and last journal entry dates
      let firstEntryDate = '9999-99-01';
      let lastEntryDate = '0000-00-01';
      entries.forEach((je) => {
        const d = new Date(je.periodDate);
        const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
        if (yearMonth < firstEntryDate) firstEntryDate = yearMonth;
        if (yearMonth > lastEntryDate) lastEntryDate = yearMonth;
      });

      // Hide if too far in the past: last entry is more than 3 months before window start
      if (lastEntryDate < pastCutoffYearMonth) return false;
      
      // Hide if too far in the future: first entry is more than 3 months after window end
      if (firstEntryDate >= futureCutoffYearMonth) return false;

      return true;
    });
  }, [typeFilteredSchedules, monthColumns, startYearMonth]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedSchedules = useMemo(() => {
    if (!sortKey) return filteredSchedules;
    const list = [...filteredSchedules];
    if (sortKey === 'contactName') {
      list.sort((a, b) => {
        const va = (a.contactName ?? '').toLowerCase();
        const vb = (b.contactName ?? '').toLowerCase();
        const cmp = va.localeCompare(vb);
        return sortDir === 'asc' ? cmp : -cmp;
      });
    } else if (sortKey === 'account') {
      list.sort((a, b) => {
        const va = getAccountCodeAndName(a).toLowerCase();
        const vb = getAccountCodeAndName(b).toLowerCase();
        const cmp = va.localeCompare(vb);
        return sortDir === 'asc' ? cmp : -cmp;
      });
    } else {
      // sort by month amount (yearMonth key)
      list.sort((a, b) => {
        const amountByMonthA = getAmountByMonth(a);
        const amountByMonthB = getAmountByMonth(b);
        const va = amountByMonthA.get(sortKey) ?? 0;
        const vb = amountByMonthB.get(sortKey) ?? 0;
        const cmp = va - vb;
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return list;
  }, [filteredSchedules, sortKey, sortDir]);

  const handleRowClick = (scheduleId: number) => {
    router.push(`/app/schedules/${scheduleId}?tenantId=${tenantId}`);
  };

  const handleExportToExcel = () => {
    const tabLabel = activeTab === 'prepayment' ? 'Prepayment' : 'Unearned Revenue';
    
    // Build Monthly Amounts to Post data
    const amountsData: (string | number)[][] = [];
    amountsData.push(['Monthly Amounts to Post']);
    amountsData.push([
      'Contact Name',
      'Account Code and Name',
      ...monthColumns.map((col) => col.label),
    ]);

    filteredSchedules.forEach((schedule) => {
      const amountByMonth = getAmountByMonth(schedule);
      const row: (string | number)[] = [
        schedule.contactName || '-',
        getAccountCodeAndName(schedule),
        ...monthColumns.map((col) => {
          const amount = amountByMonth.get(col.yearMonth);
          if (amount == null || Math.round(amount * 100) === 0) return '';
          return amount;
        }),
      ];
      amountsData.push(row);
    });

    // Add totals row for amounts
    amountsData.push([
      'Total',
      '',
      ...monthColumns.map((col) => {
        const total = monthTotals.get(col.yearMonth) ?? 0;
        if (Math.round(total * 100) === 0) return '';
        return total;
      }),
    ]);

    // Add empty row as separator
    amountsData.push([]);
    amountsData.push([]);

    // Build Remaining Balance at Month End data
    amountsData.push(['Remaining Balance at Month End']);
    amountsData.push([
      'Contact Name',
      'Account Code and Name',
      ...monthColumns.map((col) => col.label),
    ]);

    filteredSchedules.forEach((schedule) => {
      const balanceByMonth = getRemainingBalanceByMonth(schedule);
      const row: (string | number)[] = [
        schedule.contactName || '-',
        getAccountCodeAndName(schedule),
        ...monthColumns.map((col) => {
          const balance = balanceByMonth.get(col.yearMonth);
          if (balance == null || Math.round(balance * 100) === 0) return '';
          return balance;
        }),
      ];
      amountsData.push(row);
    });

    // Add totals row for balance
    amountsData.push([
      'Total',
      '',
      ...monthColumns.map((col) => {
        const total = balanceTotalsByMonth.get(col.yearMonth) ?? 0;
        if (Math.round(total * 100) === 0) return '';
        return total;
      }),
    ]);

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(amountsData);

    // Set column widths
    ws['!cols'] = [
      { wch: 20 }, // Contact Name
      { wch: 30 }, // Account Code and Name
      ...monthColumns.map(() => ({ wch: 12 })), // Month columns
    ];

    XLSX.utils.book_append_sheet(wb, ws, tabLabel);

    // Generate filename with date range
    const filename = `Analytics_${tabLabel}_${rangeLabel.replace(' – ', '_to_')}.xlsx`;
    XLSX.writeFile(wb, filename);
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
      <div className="max-w-[1800px] mx-auto">
        {error && (
          <ErrorMessage message={error} onDismiss={() => setError(null)} />
        )}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Title always visible - consistent with other pages */}
          <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
            <h3 className="text-base font-bold text-gray-900">Analytics</h3>
            <p className="text-xs text-gray-500 mt-0.5">Monthly amounts to be posted by contact and account</p>
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
                      title="Previous 10 months"
                      aria-label="Previous 10 months"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => shiftStartMonth(1)}
                      disabled={loading}
                      className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Next 10 months"
                      aria-label="Next 10 months"
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
                    <button
                      type="button"
                      onClick={handleExportToExcel}
                      disabled={loading || filteredSchedules.length === 0}
                      className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title={`Export ${activeTab === 'prepayment' ? 'Prepayment' : 'Unearned Revenue'} to Excel`}
                      aria-label={`Export ${activeTab === 'prepayment' ? 'Prepayment' : 'Unearned Revenue'} to Excel`}
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Legend and info section */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-5 text-xs">
              <div className="flex items-center gap-4">
                <span className="text-gray-500 font-medium">Legend:</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-green-500"></span>
                  <span className="text-gray-600">Posted</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                  <span className="text-gray-600">Pending</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-gray-400"></span>
                  <span className="text-gray-600">No entry</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-gray-400">
                <Info className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Schedules are hidden if outside the visible period by more than 3 months</span>
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
                        <button
                          type="button"
                          onClick={() => handleSort('contactName')}
                          className="flex items-center gap-1 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                          title="Sort by Contact Name"
                          aria-label={sortKey === 'contactName' ? `Sort by Contact Name ${sortDir === 'asc' ? 'descending' : 'ascending'}` : 'Sort by Contact Name'}
                        >
                          Contact Name
                          {sortKey === 'contactName' ? (sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />) : null}
                        </button>
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleSort('account')}
                          className="flex items-center gap-1 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                          title="Sort by Account"
                          aria-label={sortKey === 'account' ? `Sort by Account ${sortDir === 'asc' ? 'descending' : 'ascending'}` : 'Sort by Account'}
                        >
                          Account Code and Name
                          {sortKey === 'account' ? (sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />) : null}
                        </button>
                      </th>
                      {monthColumns.map((col) => (
                        <th
                          key={col.key}
                          className="text-right py-3 px-3 font-semibold text-gray-700 whitespace-nowrap"
                        >
                          <button
                            type="button"
                            onClick={() => handleSort(col.yearMonth)}
                            className="inline-flex items-center justify-end gap-1 w-full hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                            title={`Sort by ${col.label}`}
                            aria-label={sortKey === col.yearMonth ? `Sort by ${col.label} ${sortDir === 'asc' ? 'descending' : 'ascending'}` : `Sort by ${col.label}`}
                          >
                            {col.label}
                            {sortKey === col.yearMonth ? (sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />) : null}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSchedules.length === 0 ? (
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
                      sortedSchedules.map((schedule) => {
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
                  {sortedSchedules.length > 0 && (
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
                          <button
                            type="button"
                            onClick={() => handleSort('contactName')}
                            className="flex items-center gap-1 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                            title="Sort by Contact Name"
                            aria-label={sortKey === 'contactName' ? `Sort by Contact Name ${sortDir === 'asc' ? 'descending' : 'ascending'}` : 'Sort by Contact Name'}
                          >
                            Contact Name
                            {sortKey === 'contactName' ? (sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />) : null}
                          </button>
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleSort('account')}
                            className="flex items-center gap-1 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                            title="Sort by Account"
                            aria-label={sortKey === 'account' ? `Sort by Account ${sortDir === 'asc' ? 'descending' : 'ascending'}` : 'Sort by Account'}
                          >
                            Account Code and Name
                            {sortKey === 'account' ? (sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />) : null}
                          </button>
                        </th>
                        {monthColumns.map((col) => (
                          <th
                            key={col.key}
                            className="text-right py-3 px-3 font-semibold text-gray-700 whitespace-nowrap"
                          >
                            <button
                              type="button"
                              onClick={() => handleSort(col.yearMonth)}
                              className="inline-flex items-center justify-end gap-1 w-full hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                              title={`Sort by ${col.label}`}
                              aria-label={sortKey === col.yearMonth ? `Sort by ${col.label} ${sortDir === 'asc' ? 'descending' : 'ascending'}` : `Sort by ${col.label}`}
                            >
                              {col.label}
                              {sortKey === col.yearMonth ? (sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />) : null}
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedSchedules.length === 0 ? (
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
                        sortedSchedules.map((schedule) => {
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
                    {sortedSchedules.length > 0 && (
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
