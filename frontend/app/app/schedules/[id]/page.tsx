'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { scheduleApi, journalApi } from '@/lib/api';
import { formatDate, formatCurrency } from '@/lib/utils';
import type { Schedule, JournalEntry } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import DashboardLayout from '@/components/DashboardLayout';
import ScheduleDetailSkeleton from '@/components/ScheduleDetailSkeleton';
import { ArrowLeft, Calendar, DollarSign, CheckCircle, XCircle, Upload, Loader2 } from 'lucide-react';

function ScheduleDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState<Set<number>>(new Set());
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string>('');

  const scheduleId = params?.id ? parseInt(params.id as string) : null;

  useEffect(() => {
    const tenantIdParam = searchParams.get('tenantId');
    if (tenantIdParam && scheduleId) {
      setTenantId(tenantIdParam);
      loadSchedule(scheduleId, tenantIdParam);
    } else {
      setError('Missing Tenant ID or Schedule ID');
      setLoading(false);
    }
  }, [searchParams, scheduleId]);

  const loadSchedule = async (id: number, tid: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await scheduleApi.getSchedule(id);
      setSchedule(data);
    } catch (err: any) {
      console.error('Error loading schedule:', err);
      setError(err.message || 'Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  const handlePostJournal = async (journalEntry: JournalEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!tenantId || journalEntry.posted) {
      return;
    }

    setPosting(prev => new Set(prev).add(journalEntry.id));

    try {
      const response = await journalApi.postJournal({
        journalEntryId: journalEntry.id,
        tenantId: tenantId,
      });

      if (response.success) {
        // Reload schedule to get updated journal entries
        if (scheduleId) {
          await loadSchedule(scheduleId, tenantId);
        }
      } else {
        throw new Error(response.message || 'Failed to post journal');
      }
    } catch (err: any) {
      console.error('Error posting journal:', err);
      alert(`Failed to post journal: ${err.message || 'Unknown error'}`);
    } finally {
      setPosting(prev => {
        const next = new Set(prev);
        next.delete(journalEntry.id);
        return next;
      });
    }
  };

  if (loading && !tenantId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner message="Loading..." />
      </div>
    );
  }

  if (loading) {
    return (
      <DashboardLayout tenantId={tenantId}>
        <ScheduleDetailSkeleton />
      </DashboardLayout>
    );
  }

  if (error && !schedule) {
    return (
      <DashboardLayout tenantId={tenantId}>
        <div className="max-w-[1800px] mx-auto">
          <ErrorMessage message={error} />
        </div>
      </DashboardLayout>
    );
  }

  if (!schedule) {
    return (
      <DashboardLayout tenantId={tenantId}>
        <div className="max-w-[1800px] mx-auto">
          <ErrorMessage message="Schedule not found" />
        </div>
      </DashboardLayout>
    );
  }

  const journalEntries = schedule.journalEntries || [];
  const sortedEntries = [...journalEntries].sort((a, b) => 
    new Date(a.periodDate).getTime() - new Date(b.periodDate).getTime()
  );

  return (
    <DashboardLayout tenantId={tenantId}>
      <div className="space-y-7 max-w-[1800px] mx-auto">
        {/* Back Button */}
        <button
          onClick={() => router.push(`/app/schedules/register?tenantId=${tenantId}`)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Schedule Register
        </button>

        {/* Schedule Summary Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md hover:border-gray-300">
          <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
            <h2 className="text-base font-bold text-gray-900">Schedule Details</h2>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <div>
                <div className="text-xs text-gray-500 mb-1">Type</div>
                <span
                  className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                    schedule.type === 'PREPAID'
                      ? 'bg-blue-50 text-blue-600'
                      : 'bg-green-50 text-green-600'
                  }`}
                >
                  {schedule.type === 'PREPAID' ? 'Prepaid Expense' : 'Unearned Revenue'}
                </span>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Total Amount</div>
                <div className="text-sm font-bold text-gray-900">{formatCurrency(schedule.totalAmount)}</div>
                {schedule.remainingBalance !== undefined && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    Remaining: {formatCurrency(schedule.remainingBalance)}
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Period</div>
                <div className="text-sm text-gray-900">
                  {formatDate(schedule.startDate)} - {formatDate(schedule.endDate)}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {schedule.totalPeriods || 0} {schedule.totalPeriods === 1 ? 'period' : 'periods'}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Status</div>
                {schedule.postedPeriods === schedule.totalPeriods && schedule.totalPeriods ? (
                  <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold bg-green-100 text-green-700">
                    Complete ({schedule.postedPeriods}/{schedule.totalPeriods})
                  </span>
                ) : (
                  <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold bg-yellow-100 text-yellow-700">
                    In Progress ({schedule.postedPeriods || 0}/{schedule.totalPeriods || 0})
                  </span>
                )}
              </div>
            </div>
            <div className="mt-5 pt-5 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Account Codes</div>
                  <div className="text-sm text-gray-900">
                    {schedule.type === 'PREPAID' ? schedule.expenseAcctCode : schedule.revenueAcctCode} 
                    {' '}({schedule.type === 'PREPAID' ? 'Expense' : 'Revenue'})
                  </div>
                  <div className="text-sm text-gray-900 mt-1">
                    {schedule.deferralAcctCode} (Deferral)
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Created</div>
                  <div className="text-sm text-gray-900">{formatDate(schedule.createdAt)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Journal Entries Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md hover:border-gray-300">
          <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
            <h3 className="text-base font-bold text-gray-900">Journal Entries</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {sortedEntries.length} {sortedEntries.length === 1 ? 'entry' : 'entries'} total
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="px-5 py-3">Period Date</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Xero Journal ID</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="text-sm font-medium text-gray-900">{formatDate(entry.periodDate)}</div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-sm font-bold text-gray-900">{formatCurrency(entry.amount)}</div>
                    </td>
                    <td className="px-5 py-3">
                      {entry.posted ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-green-100 text-green-700">
                          <CheckCircle className="w-3 h-3" />
                          Posted
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-gray-100 text-gray-700">
                          <XCircle className="w-3 h-3" />
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {entry.xeroManualJournalId ? (
                        <div className="text-xs text-gray-600 font-mono">{entry.xeroManualJournalId}</div>
                      ) : (
                        <div className="text-xs text-gray-400">-</div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {entry.posted ? (
                        <span className="text-xs text-gray-400">Already posted</span>
                      ) : (
                        <button
                          onClick={(e) => handlePostJournal(entry, e)}
                          disabled={posting.has(entry.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#6d69ff] rounded-lg hover:bg-[#5a56e6] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {posting.has(entry.id) ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Posting...
                            </>
                          ) : (
                            <>
                              <Upload className="w-3 h-3" />
                              Post to Xero
                            </>
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {sortedEntries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <Calendar className="w-8 h-8 text-gray-300" />
                        <p>No journal entries found for this schedule.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function ScheduleDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white">
          <div className="fixed inset-y-0 left-0 w-56 bg-[#F9FAFB] z-10 border-r border-gray-200"></div>
          <div className="pl-56">
            <div className="p-8">
              <LoadingSpinner message="Loading..." />
            </div>
          </div>
        </div>
      }
    >
      <ScheduleDetailContent />
    </Suspense>
  );
}

