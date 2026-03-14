'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { xeroApi, settingsApi, scheduleApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { getOrgCurrency } from '@/lib/OrgContext';
import type { XeroBalanceSheetResponse, Schedule } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import DashboardLayout from '@/components/DashboardLayout';
import { Calendar, RefreshCw, AlertTriangle } from 'lucide-react';

function XeroReconciliationPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string>('');
  const [balanceSheet, setBalanceSheet] = useState<XeroBalanceSheetResponse | null>(null);
  const [balanceSheetPlus12, setBalanceSheetPlus12] = useState<XeroBalanceSheetResponse | null>(null);
  const [balanceSheetPlus11, setBalanceSheetPlus11] = useState<XeroBalanceSheetResponse | null>(null);
  const [balanceSheetPlus13, setBalanceSheetPlus13] = useState<XeroBalanceSheetResponse | null>(null);
  const [prepaymentAcctCode, setPrepaymentAcctCode] = useState<string>('');
  const [unearnedAcctCode, setUnearnedAcctCode] = useState<string>('');
  const [defaultAccountsLoaded, setDefaultAccountsLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<'prepayment' | 'unearned'>('prepayment');
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  const orgCurrency = getOrgCurrency(tenantId) || 'USD';

  const getDefaultMonth = () => {
    const today = new Date();
    const d = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  };
  const [selectedMonth, setSelectedMonth] = useState<string>(getDefaultMonth());

  /** Format YYYY-MM-DD as "Saturday, 31 January 2026" without timezone conversion. */
  const formatReportDate = (isoDate: string) => {
    const [y, m, d] = (isoDate || '').split('-').map(Number);
    if (!y || !m || !d) return isoDate;
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  /**
   * Xero Balance Sheet API returns amounts one year behind the requested date.
   * Show the date one year earlier so it matches the actual data.
   */
  const formatReportDateToMatchAmounts = (isoDate: string) => {
    const [y, m, d] = (isoDate || '').split('-').map(Number);
    if (!y || !m || !d) return isoDate;
    const date = new Date(y - 1, m - 1, d);
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  /** Last day of the selected month as YYYY-MM-DD for the API (e.g. 2026-01 -> 2026-01-31) */
  const getMonthEndDate = (yearMonth: string) => {
    const [y, m] = yearMonth.split('-').map(Number);
    const year = Math.floor(y);
    const monthIndex = Math.max(0, Math.min(11, m - 1));
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    return `${year}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  };

  /** Format last day of (selected month + monthOffset) as "28 Feb 2026" for column headers */
  const getMonthEndLabel = (yearMonth: string, monthOffset: number) => {
    const [y, m] = yearMonth.split('-').map(Number);
    const lastDay = new Date(y, m - 1 + monthOffset + 1, 0);
    const day = lastDay.getDate();
    const monthYear = lastDay.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
    return `${day} ${monthYear}`;
  };

  /** Last day of the selected month + N months (e.g. 2026-01, 12 -> 2027-01-31) */
  const getMonthEndDatePlusNMonths = (yearMonth: string, n: number) => {
    const [y, m] = yearMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + n, 0);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const lastDay = d.getDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  };

  /** Month-end YYYY-MM-DD for (selectedMonth + offset), matching getMonthEndLabel offsets */
  const getMonthEndDateForOffset = (yearMonth: string, offset: number) => {
    const [y, m] = yearMonth.split('-').map(Number);
    const d = new Date(y, m + offset, 0);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const lastDay = d.getDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  };

  /** Compute total remaining balance at a month-end cutoff for all schedules of a given type */
  const getTotalRemainingBalance = (type: 'PREPAID' | 'UNEARNED', cutoffDate: string): number => {
    return schedules
      .filter((s) => s.type === type && !s.voided)
      .reduce((total, schedule) => {
        const scheduleTotal = schedule.totalAmount ?? 0;
        const entries = schedule.journalEntries ?? [];
        const writeOffEntry = entries.find((je) => je.writeOff);
        const fromDate = schedule.invoiceDate || schedule.startDate;

        if (fromDate && cutoffDate < fromDate.slice(0, 7) + '-01') return total;

        if (writeOffEntry?.periodDate && cutoffDate >= writeOffEntry.periodDate) {
          return total;
        }

        if (cutoffDate < schedule.startDate) {
          return total + scheduleTotal;
        }

        const recognised = entries
          .filter((je) => !je.writeOff && je.periodDate <= cutoffDate)
          .reduce((sum, je) => sum + (je.amount ?? 0), 0);
        return total + Math.max(0, scheduleTotal - recognised);
      }, 0);
  };

  useEffect(() => {
    const tenantIdParam = searchParams.get('tenantId');
    if (tenantIdParam) {
      setTenantId(tenantIdParam);
      Promise.all([
        settingsApi.getSettings(tenantIdParam).then((settings) => {
          setPrepaymentAcctCode(settings.prepaymentAccount || '');
          setUnearnedAcctCode(settings.unearnedAccount || '');
        }),
        scheduleApi.getSchedules(tenantIdParam).then((res) => {
          setSchedules(res.schedules);
        }),
      ]).catch(() => {}).finally(() => setDefaultAccountsLoaded(true));
    } else {
      setError('Missing Tenant ID');
      setLoading(false);
    }
  }, [searchParams]);

  const loadBalanceSheet = useCallback(async () => {
    if (!tenantId) return;
    try {
      setLoading(true);
      setError(null);
      const monthEndDate = getMonthEndDate(selectedMonth);
      const monthEndPlus11 = getMonthEndDatePlusNMonths(selectedMonth, 11);
      const monthEndPlus12 = getMonthEndDatePlusNMonths(selectedMonth, 12);
      const monthEndPlus13 = getMonthEndDatePlusNMonths(selectedMonth, 13);
      const [data, dataPlus11, dataPlus12, dataPlus13] = await Promise.all([
        xeroApi.getBalanceSheet(tenantId, monthEndDate),
        xeroApi.getBalanceSheet(tenantId, monthEndPlus11),
        xeroApi.getBalanceSheet(tenantId, monthEndPlus12),
        xeroApi.getBalanceSheet(tenantId, monthEndPlus13),
      ]) as [XeroBalanceSheetResponse, XeroBalanceSheetResponse, XeroBalanceSheetResponse, XeroBalanceSheetResponse];
      setBalanceSheet(data);
      setBalanceSheetPlus11(dataPlus11);
      setBalanceSheetPlus12(dataPlus12);
      setBalanceSheetPlus13(dataPlus13);
    } catch (err: any) {
      console.error('Error loading balance sheet:', err);
      setError(err.message || 'Failed to load balance sheet from Xero');
      setBalanceSheet(null);
      setBalanceSheetPlus11(null);
      setBalanceSheetPlus12(null);
      setBalanceSheetPlus13(null);
    } finally {
      setLoading(false);
    }
  }, [tenantId, selectedMonth]);

  useEffect(() => {
    if (tenantId && selectedMonth) {
      loadBalanceSheet();
    }
  }, [tenantId, selectedMonth, loadBalanceSheet]);

  if (!tenantId) {
    return (
      <DashboardLayout tenantId="">
        <div className="flex min-h-[400px] items-center justify-center">
          <ErrorMessage message={error || 'Missing Tenant ID'} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout tenantId={tenantId} pageTitle="Xero Reconciliation">
      <div className="space-y-6">
        {/* Date filter and balance sheet card - when settings loaded */}
        {defaultAccountsLoaded && (
          <>
            <div className="flex flex-wrap items-center gap-4 rounded-lg border border-gray-200 bg-gray-50/50 p-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-gray-500" />
                <label htmlFor="recon-month" className="text-sm font-medium text-gray-700">
                  As of month (balance at month end)
                </label>
              </div>
              <input
                id="recon-month"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <button
                onClick={loadBalanceSheet}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            {error && (
              <ErrorMessage message={error} />
            )}

            {loading && !balanceSheet ? (
              <div className="flex min-h-[300px] items-center justify-center">
                <LoadingSpinner />
              </div>
            ) : balanceSheet ? (
          <div className="flex flex-col">
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('prepayment')}
                    className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                      activeTab === 'prepayment'
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Prepayment
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('unearned')}
                    className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                      activeTab === 'unearned'
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Unearned Revenue
                  </button>
                </div>
              </div>
              <div className="p-4">
                {activeTab === 'prepayment' && !prepaymentAcctCode && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">
                        Default Prepayment Asset Account not configured
                      </p>
                      <p className="text-xs text-amber-600 mt-1">
                        Please configure your default accounts in{' '}
                        <button
                          type="button"
                          onClick={() => router.push(`/app/settings?tenantId=${tenantId}`)}
                          className="underline font-medium hover:text-amber-800"
                        >
                          Settings
                        </button>{' '}
                        to view the prepayment balance.
                      </p>
                    </div>
                  </div>
                )}
                {activeTab === 'prepayment' && prepaymentAcctCode && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 table-fixed">
                      <colgroup>
                        <col className="min-w-[180px]" />
                        <col className="w-32" />
                        <col className="w-32" />
                        <col className="w-32" />
                      </colgroup>
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Account</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">{getMonthEndLabel(selectedMonth, 0)}</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">{getMonthEndLabel(selectedMonth, -1)}</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">{getMonthEndLabel(selectedMonth, -2)}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {(() => {
                          const acc = balanceSheet.accounts.find((a) => a.accountCode === prepaymentAcctCode);
                          const amountPlus13 = balanceSheetPlus13?.accounts?.find((a) => a.accountCode === prepaymentAcctCode);
                          const amountPlus12 = balanceSheetPlus12?.accounts?.find((a) => a.accountCode === prepaymentAcctCode);
                          const amountPlus11 = balanceSheetPlus11?.accounts?.find((a) => a.accountCode === prepaymentAcctCode);
                          const x0 = amountPlus13?.amount ?? null;
                          const x1 = amountPlus12?.amount ?? null;
                          const x2 = amountPlus11?.amount ?? null;
                          const b0 = getTotalRemainingBalance('PREPAID', getMonthEndDateForOffset(selectedMonth, 0));
                          const b1 = getTotalRemainingBalance('PREPAID', getMonthEndDateForOffset(selectedMonth, -1));
                          const b2 = getTotalRemainingBalance('PREPAID', getMonthEndDateForOffset(selectedMonth, -2));
                          const v0 = x0 != null ? x0 - b0 : null;
                          const v1 = x1 != null ? x1 - b1 : null;
                          const v2 = x2 != null ? x2 - b2 : null;
                          if (!acc) {
                            return (
                              <>
                                <tr>
                                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">No matching account found.</td>
                                </tr>
                                <tr className="bg-blue-50/50">
                                  <td className="px-4 py-3 text-sm font-medium text-gray-900">Prepaidly Schedules</td>
                                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-700">{formatCurrency(b0, orgCurrency)}</td>
                                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-700">{formatCurrency(b1, orgCurrency)}</td>
                                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-700">{formatCurrency(b2, orgCurrency)}</td>
                                </tr>
                                <tr>
                                  <td className="px-4 py-3 text-sm font-medium text-gray-700">Variance (Xero − Prepaidly)</td>
                                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-500">—</td>
                                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-500">—</td>
                                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-500">—</td>
                                </tr>
                              </>
                            );
                          }
                          return (
                            <>
                              <tr className="hover:bg-gray-50/50">
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">{(acc.accountCode || '—') + ' - ' + (acc.accountName || '—')}</td>
                                <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-gray-900">
                                  {x0 != null ? formatCurrency(x0, orgCurrency) : '—'}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-700">
                                  {x1 != null ? formatCurrency(x1, orgCurrency) : '—'}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-700">
                                  {x2 != null ? formatCurrency(x2, orgCurrency) : '—'}
                                </td>
                              </tr>
                              <tr className="bg-blue-50/50 hover:bg-blue-50/70">
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">Prepaidly Schedules</td>
                                <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-700">{formatCurrency(b0, orgCurrency)}</td>
                                <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-700">{formatCurrency(b1, orgCurrency)}</td>
                                <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-700">{formatCurrency(b2, orgCurrency)}</td>
                              </tr>
                              <tr className="bg-amber-50/50 border-t-2 border-amber-200">
                                <td className="px-4 py-3 text-sm font-semibold text-gray-800">Variance (Xero − Prepaidly)</td>
                                <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-gray-800">
                                  {v0 != null ? formatCurrency(v0, orgCurrency) : '—'}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-gray-800">
                                  {v1 != null ? formatCurrency(v1, orgCurrency) : '—'}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-gray-800">
                                  {v2 != null ? formatCurrency(v2, orgCurrency) : '—'}
                                </td>
                              </tr>
                            </>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                )}
                {activeTab === 'unearned' && !unearnedAcctCode && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">
                        Default Unearned Revenue Liability Account not configured
                      </p>
                      <p className="text-xs text-amber-600 mt-1">
                        Please configure your default accounts in{' '}
                        <button
                          type="button"
                          onClick={() => router.push(`/app/settings?tenantId=${tenantId}`)}
                          className="underline font-medium hover:text-amber-800"
                        >
                          Settings
                        </button>{' '}
                        to view the unearned revenue balance.
                      </p>
                    </div>
                  </div>
                )}
                {activeTab === 'unearned' && unearnedAcctCode && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 table-fixed">
                      <colgroup>
                        <col className="min-w-[180px]" />
                        <col className="w-32" />
                        <col className="w-32" />
                        <col className="w-32" />
                      </colgroup>
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Account</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">{getMonthEndLabel(selectedMonth, 0)}</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">{getMonthEndLabel(selectedMonth, -1)}</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">{getMonthEndLabel(selectedMonth, -2)}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {(() => {
                          const acc = balanceSheet.accounts.find((a) => a.accountCode === unearnedAcctCode);
                          const amountPlus13 = balanceSheetPlus13?.accounts?.find((a) => a.accountCode === unearnedAcctCode);
                          const amountPlus12 = balanceSheetPlus12?.accounts?.find((a) => a.accountCode === unearnedAcctCode);
                          const amountPlus11 = balanceSheetPlus11?.accounts?.find((a) => a.accountCode === unearnedAcctCode);
                          const x0 = amountPlus13?.amount ?? null;
                          const x1 = amountPlus12?.amount ?? null;
                          const x2 = amountPlus11?.amount ?? null;
                          const b0 = getTotalRemainingBalance('UNEARNED', getMonthEndDateForOffset(selectedMonth, 0));
                          const b1 = getTotalRemainingBalance('UNEARNED', getMonthEndDateForOffset(selectedMonth, -1));
                          const b2 = getTotalRemainingBalance('UNEARNED', getMonthEndDateForOffset(selectedMonth, -2));
                          const v0 = x0 != null ? x0 - b0 : null;
                          const v1 = x1 != null ? x1 - b1 : null;
                          const v2 = x2 != null ? x2 - b2 : null;
                          if (!acc) {
                            return (
                              <>
                                <tr>
                                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">No matching account found.</td>
                                </tr>
                                <tr className="bg-blue-50/50">
                                  <td className="px-4 py-3 text-sm font-medium text-gray-900">Prepaidly Schedules</td>
                                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-700">{formatCurrency(b0, orgCurrency)}</td>
                                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-700">{formatCurrency(b1, orgCurrency)}</td>
                                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-700">{formatCurrency(b2, orgCurrency)}</td>
                                </tr>
                                <tr>
                                  <td className="px-4 py-3 text-sm font-medium text-gray-700">Variance (Xero − Prepaidly)</td>
                                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-500">—</td>
                                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-500">—</td>
                                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-500">—</td>
                                </tr>
                              </>
                            );
                          }
                          return (
                            <>
                              <tr className="hover:bg-gray-50/50">
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">{(acc.accountCode || '—') + ' - ' + (acc.accountName || '—')}</td>
                                <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-gray-900">
                                  {x0 != null ? formatCurrency(x0, orgCurrency) : '—'}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-700">
                                  {x1 != null ? formatCurrency(x1, orgCurrency) : '—'}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-700">
                                  {x2 != null ? formatCurrency(x2, orgCurrency) : '—'}
                                </td>
                              </tr>
                              <tr className="bg-blue-50/50 hover:bg-blue-50/70">
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">Prepaidly Schedules</td>
                                <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-700">{formatCurrency(b0, orgCurrency)}</td>
                                <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-700">{formatCurrency(b1, orgCurrency)}</td>
                                <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-700">{formatCurrency(b2, orgCurrency)}</td>
                              </tr>
                              <tr className="bg-amber-50/50 border-t-2 border-amber-200">
                                <td className="px-4 py-3 text-sm font-semibold text-gray-800">Variance (Xero − Prepaidly)</td>
                                <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-gray-800">
                                  {v0 != null ? formatCurrency(v0, orgCurrency) : '—'}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-gray-800">
                                  {v1 != null ? formatCurrency(v1, orgCurrency) : '—'}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-gray-800">
                                  {v2 != null ? formatCurrency(v2, orgCurrency) : '—'}
                                </td>
                              </tr>
                            </>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
            ) : null}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

export default function XeroReconciliationPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[400px] items-center justify-center"><LoadingSpinner /></div>}>
      <XeroReconciliationPageContent />
    </Suspense>
  );
}
