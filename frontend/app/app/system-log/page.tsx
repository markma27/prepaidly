'use client';

import { Suspense, useEffect, useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { scheduleApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { getOrgCurrency } from '@/lib/OrgContext';
import type { Schedule } from '@/lib/types';
import { isAuthenticated, getUser } from '@/lib/auth';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import DashboardLayout from '@/components/DashboardLayout';
import Skeleton from '@/components/Skeleton';
import {
  Search,
  FileText,
  Send,
  XCircle,
  BookOpen,
  Clock,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw,
} from 'lucide-react';

type LogEventType = 'SCHEDULE_CREATED' | 'JOURNAL_POSTED' | 'SCHEDULE_VOIDED' | 'WRITE_OFF' | 'CRON_JOB';

interface LogEntry {
  id: string;
  timestamp: string;
  type: LogEventType;
  scheduleId: number;
  contactName: string;
  invoiceReference: string;
  scheduleType: 'PREPAID' | 'UNEARNED';
  description: string;
  amount?: number;
  periodDate?: string;
  journalEntryId?: number;
  /** User name when known (e.g. schedule creator); 'System' for cron; '—' when not tracked */
  userName?: string;
}

const EVENT_CONFIG: Record<LogEventType, { label: string; color: string; bgColor: string; icon: typeof FileText }> = {
  SCHEDULE_CREATED: { label: 'Schedule Created', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200', icon: FileText },
  JOURNAL_POSTED: { label: 'Journal Posted', color: 'text-green-700', bgColor: 'bg-green-50 border-green-200', icon: Send },
  SCHEDULE_VOIDED: { label: 'Schedule Voided', color: 'text-red-700', bgColor: 'bg-red-50 border-red-200', icon: XCircle },
  WRITE_OFF: { label: 'Write-Off', color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200', icon: BookOpen },
  CRON_JOB: { label: 'Cron Job Auto-Post', color: 'text-purple-700', bgColor: 'bg-purple-50 border-purple-200', icon: Clock },
};

type FilterType = 'ALL' | LogEventType;

const ITEMS_PER_PAGE = 25;

/**
 * Build log entries from schedules. Uses currentUserName for Journal Posted / Write-off
 * when the backend doesn't provide postedBy (same as schedule detail Audit Trail).
 */
function deriveLogEntries(schedules: Schedule[], currentUserName?: string | null): LogEntry[] {
  const logs: LogEntry[] = [];

  for (const schedule of schedules) {
    logs.push({
      id: `sched-created-${schedule.id}`,
      timestamp: schedule.createdAt,
      type: 'SCHEDULE_CREATED',
      scheduleId: schedule.id,
      contactName: schedule.contactName || '-',
      invoiceReference: schedule.invoiceReference || '-',
      scheduleType: schedule.type,
      description: `New ${schedule.type === 'PREPAID' ? 'Prepayment' : 'Unearned Revenue'} schedule created`,
      amount: schedule.totalAmount,
      userName: schedule.createdByName || currentUserName || undefined,
    });

    if (schedule.voided) {
      const entries = schedule.journalEntries ?? [];
      const latestUpdate = entries.reduce((latest, je) => {
        const t = je.updatedAt || je.createdAt;
        return t > latest ? t : latest;
      }, schedule.createdAt);

      logs.push({
        id: `sched-voided-${schedule.id}`,
        timestamp: latestUpdate,
        type: 'SCHEDULE_VOIDED',
        scheduleId: schedule.id,
        contactName: schedule.contactName || '-',
        invoiceReference: schedule.invoiceReference || '-',
        scheduleType: schedule.type,
        description: `Schedule voided`,
        amount: schedule.totalAmount,
        userName: currentUserName || undefined,
      });
    }

    const entries = schedule.journalEntries ?? [];
    for (const je of entries) {
      if (je.posted && je.postedAt) {
        const postedDate = new Date(je.postedAt);
        const dayOfMonth = postedDate.getUTCDate();
        const isCronLikely = dayOfMonth === 1;

        if (je.writeOff) {
          logs.push({
            id: `writeoff-${je.id}`,
            timestamp: je.postedAt,
            type: 'WRITE_OFF',
            scheduleId: schedule.id,
            contactName: schedule.contactName || '-',
            invoiceReference: schedule.invoiceReference || '-',
            scheduleType: schedule.type,
            description: `Full recognition (write-off) posted for period ${formatPeriod(je.periodDate)}`,
            amount: je.amount,
            periodDate: je.periodDate,
            journalEntryId: je.id,
            userName: currentUserName || undefined,
          });
        } else {
          logs.push({
            id: `journal-posted-${je.id}`,
            timestamp: je.postedAt,
            type: isCronLikely ? 'CRON_JOB' : 'JOURNAL_POSTED',
            scheduleId: schedule.id,
            contactName: schedule.contactName || '-',
            invoiceReference: schedule.invoiceReference || '-',
            scheduleType: schedule.type,
            description: isCronLikely
              ? `Cron job auto-posted journal for period ${formatPeriod(je.periodDate)}`
              : `Journal posted for period ${formatPeriod(je.periodDate)}`,
            amount: je.amount,
            periodDate: je.periodDate,
            journalEntryId: je.id,
            userName: isCronLikely ? 'System' : (currentUserName || undefined),
          });
        }
      }
    }
  }

  logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return logs;
}

function formatPeriod(periodDate: string): string {
  if (!periodDate) return '';
  const parts = periodDate.split('T')[0].split('-');
  if (parts.length < 2) return periodDate;
  const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function formatTimestamp(ts: string): string {
  if (!ts) return '';
  const date = new Date(ts);
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const year = date.getFullYear();
  const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${day} ${month} ${year}, ${time}`;
}

function SystemLogPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);

  const orgCurrency = getOrgCurrency(tenantId) || 'USD';

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/auth/login');
      return;
    }
    const user = getUser();
    if (user) {
      setCurrentUserName(user.name || user.email?.split('@')[0] || null);
    }
  }, [router]);

  useEffect(() => {
    const tenantIdParam = searchParams.get('tenantId');
    if (tenantIdParam) {
      setTenantId(tenantIdParam);
      loadData(tenantIdParam);
    } else {
      setError('Missing Tenant ID');
      setLoading(false);
    }
  }, [searchParams]);

  const loadData = async (tid: string, skipCache = false) => {
    try {
      setLoading(true);
      setError(null);
      const response = await scheduleApi.getSchedules(tid, true, skipCache);
      setSchedules(response.schedules);
    } catch (err: any) {
      console.error('Error loading system log data:', err);
      setError(err.message || 'Failed to load system log data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    if (tenantId) {
      loadData(tenantId, true);
    }
  };

  const allLogs = useMemo(() => deriveLogEntries(schedules, currentUserName), [schedules, currentUserName]);

  const filteredLogs = useMemo(() => {
    let logs = allLogs;

    if (filterType !== 'ALL') {
      logs = logs.filter((l) => l.type === filterType);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      logs = logs.filter(
        (l) =>
          l.contactName.toLowerCase().includes(q) ||
          l.invoiceReference.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q) ||
          String(l.scheduleId).includes(q) ||
          EVENT_CONFIG[l.type].label.toLowerCase().includes(q) ||
          (l.userName && l.userName.toLowerCase().includes(q))
      );
    }

    return logs;
  }, [allLogs, filterType, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / ITEMS_PER_PAGE));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredLogs.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredLogs, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterType]);

  const stats = useMemo(() => {
    const counts: Record<LogEventType, number> = {
      SCHEDULE_CREATED: 0,
      JOURNAL_POSTED: 0,
      SCHEDULE_VOIDED: 0,
      WRITE_OFF: 0,
      CRON_JOB: 0,
    };
    for (const log of allLogs) {
      counts[log.type]++;
    }
    return counts;
  }, [allLogs]);

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
          <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900">System Log</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Activity log for all schedules — tracks creations, journal postings, voids, write-offs, and cron job runs
              </p>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div className="p-5">
            {/* Summary cards */}
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="bg-gray-50 rounded-lg border border-gray-200 p-3">
                    <Skeleton className="h-3 w-20 mb-2" variant="text" />
                    <Skeleton className="h-6 w-10" variant="text" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
                {(Object.entries(EVENT_CONFIG) as [LogEventType, typeof EVENT_CONFIG[LogEventType]][]).map(
                  ([type, config]) => {
                    const Icon = config.icon;
                    const isActive = filterType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFilterType(isActive ? 'ALL' : type)}
                        className={`rounded-lg border p-3 text-left transition-all ${
                          isActive
                            ? `${config.bgColor} ring-2 ring-offset-1 ring-current ${config.color}`
                            : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <Icon className={`w-3.5 h-3.5 ${isActive ? config.color : 'text-gray-400'}`} />
                          <span className={`text-[11px] font-medium ${isActive ? config.color : 'text-gray-500'}`}>
                            {config.label}
                          </span>
                        </div>
                        <span className={`text-lg font-bold ${isActive ? config.color : 'text-gray-900'}`}>
                          {stats[type]}
                        </span>
                      </button>
                    );
                  }
                )}
              </div>
            )}

            {/* Search & filter bar */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by contact, invoice ref, schedule ID, user, or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-[13px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6d69ff]/40 focus:border-[#6d69ff] transition-colors bg-white"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as FilterType)}
                  className="text-[13px] border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#6d69ff]/40 focus:border-[#6d69ff] bg-white"
                >
                  <option value="ALL">All Events</option>
                  {(Object.entries(EVENT_CONFIG) as [LogEventType, typeof EVENT_CONFIG[LogEventType]][]).map(
                    ([type, config]) => (
                      <option key={type} value={type}>
                        {config.label}
                      </option>
                    )
                  )}
                </select>
              </div>

              <span className="text-xs text-gray-400 ml-auto">
                {filteredLogs.length} {filteredLogs.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>

            {/* Log table */}
            {loading ? (
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full min-w-[900px] text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 whitespace-nowrap w-[170px]">Timestamp</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 whitespace-nowrap w-[100px]">User</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 whitespace-nowrap w-[150px]">Event</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 whitespace-nowrap w-[80px]">Schedule</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 whitespace-nowrap">Contact</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 whitespace-nowrap">Invoice Ref</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 whitespace-nowrap">Description</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700 whitespace-nowrap w-[100px]">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-2.5 px-4"><Skeleton className="h-4 w-36" variant="text" /></td>
                        <td className="py-2.5 px-4"><Skeleton className="h-4 w-20" variant="text" /></td>
                        <td className="py-2.5 px-4"><Skeleton className="h-5 w-28" variant="text" /></td>
                        <td className="py-2.5 px-4"><Skeleton className="h-4 w-12" variant="text" /></td>
                        <td className="py-2.5 px-4"><Skeleton className="h-4 w-24" variant="text" /></td>
                        <td className="py-2.5 px-4"><Skeleton className="h-4 w-20" variant="text" /></td>
                        <td className="py-2.5 px-4"><Skeleton className="h-4 w-48" variant="text" /></td>
                        <td className="py-2.5 px-4 text-right"><Skeleton className="h-4 w-16 ml-auto" variant="text" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="border border-gray-200 rounded-lg py-16 text-center">
                <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-500">No log entries found</p>
                <p className="text-xs text-gray-400 mt-1">
                  {searchQuery
                    ? 'Try adjusting your search query or filter'
                    : 'Activity will appear here as schedules are created and journals are posted'}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full min-w-[900px] text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700 whitespace-nowrap w-[170px]">Timestamp</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700 whitespace-nowrap w-[100px]">User</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700 whitespace-nowrap w-[150px]">Event</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700 whitespace-nowrap w-[80px]">Schedule</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700 whitespace-nowrap">Contact</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700 whitespace-nowrap">Invoice Ref</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700 whitespace-nowrap">Description</th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-700 whitespace-nowrap w-[100px]">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedLogs.map((log) => {
                        const config = EVENT_CONFIG[log.type];
                        const Icon = config.icon;
                        return (
                          <tr
                            key={log.id}
                            className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors"
                          >
                            <td className="py-2.5 px-4 text-gray-500 whitespace-nowrap tabular-nums">
                              {formatTimestamp(log.timestamp)}
                            </td>
                            <td className="py-2.5 px-4 text-gray-700 whitespace-nowrap">
                              {log.userName ?? '—'}
                            </td>
                            <td className="py-2.5 px-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium border ${config.bgColor} ${config.color}`}
                              >
                                <Icon className="w-3 h-3" />
                                {config.label}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 whitespace-nowrap">
                              <span className="text-gray-700 font-mono text-[11px]">#{log.scheduleId}</span>
                            </td>
                            <td className="py-2.5 px-4 text-gray-900 whitespace-nowrap">
                              {log.contactName}
                            </td>
                            <td className="py-2.5 px-4 text-gray-700 whitespace-nowrap">
                              {log.invoiceReference}
                            </td>
                            <td className="py-2.5 px-4 text-gray-600 max-w-[300px] truncate" title={log.description}>
                              {log.description}
                            </td>
                            <td className="py-2.5 px-4 text-right text-gray-900 whitespace-nowrap tabular-nums font-medium">
                              {log.amount != null ? formatCurrency(log.amount, orgCurrency) : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-xs text-gray-500">
                      Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
                      {Math.min(currentPage * ITEMS_PER_PAGE, filteredLogs.length)} of{' '}
                      {filteredLogs.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-medium text-gray-700 px-3">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function SystemLogPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-[1800px] mx-auto p-6">
          <LoadingSpinner message="Loading system log..." />
        </div>
      }
    >
      <SystemLogPageContent />
    </Suspense>
  );
}
