'use client';

import { Suspense, useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { scheduleApi, journalApi } from '@/lib/api';
import { formatDate, formatCurrency } from '@/lib/utils';
import type { Schedule, JournalEntry } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import DashboardLayout from '@/components/DashboardLayout';
import ScheduleDetailSkeleton from '@/components/ScheduleDetailSkeleton';
import { ArrowLeft, Calendar, DollarSign, CheckCircle, XCircle, Upload, Loader2, ExternalLink, Clock, User, FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

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

  // Get current user name from Supabase
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const supabase = createClient();
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error fetching user session:', error);
          return;
        }
        
        if (session?.user) {
          const email = session.user.email || 'user@example.com';
          const name = session.user.user_metadata?.full_name || 
                      session.user.user_metadata?.name || 
                      email.split('@')[0] || 
                      'User';
          
          setCurrentUserName(name);
          
          // Also get user ID from sessionStorage for backward compatibility
          try {
            const userStr = sessionStorage.getItem('user');
            if (userStr) {
              const user = JSON.parse(userStr);
              setCurrentUserId(user.id || null);
            }
          } catch (e) {
            console.error('Error parsing user from sessionStorage:', e);
          }
        }
      } catch (err) {
        console.error('Error loading user info:', err);
      }
    };
    
    fetchUserInfo();
  }, []);

  // Build audit trail from available data (must be called before any conditional returns)
  const auditTrail = useMemo(() => {
    if (!schedule) return [];
    
    const trail: Array<{
      id: string;
      date: string;
      action: string;
      description: string;
      userName?: string;
      userId?: number;
      details?: string;
    }> = [];

    const journalEntries = schedule.journalEntries || [];

    // Schedule creation
    if (schedule.createdAt) {
      trail.push({
        id: `schedule-created-${schedule.id}`,
        date: schedule.createdAt,
        action: 'Schedule Created',
        description: `Schedule ${schedule.id} was created`,
        userName: schedule.createdByName, // Use creator name from backend
        userId: schedule.createdBy,
        details: `Type: ${schedule.type === 'PREPAID' ? 'Prepaid Expense' : 'Unearned Revenue'}, Amount: ${formatCurrency(schedule.totalAmount)}`
      });
    }

    // Journal entry postings (only posted entries)
    // Note: Backend doesn't currently track postedBy, so we show current user if available
    // For historical posts, user info won't be available until backend is updated
    journalEntries
      .filter(entry => entry.posted && entry.xeroManualJournalId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .forEach(entry => {
        trail.push({
          id: `journal-posted-${entry.id}`,
          date: entry.createdAt,
          action: 'Journal Posted',
          description: `Journal entry for ${formatDate(entry.periodDate)} posted to Xero`,
          userName: currentUserName || undefined, // Show current user name if available
          userId: currentUserId || undefined,
          details: `Amount: ${formatCurrency(entry.amount)}, Xero Journal ID: ${entry.xeroManualJournalId}`
        });
      });

    // Sort by date (newest first)
    return trail.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [schedule, currentUserName, currentUserId]);

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

  const journalEntries = schedule?.journalEntries || [];
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
                  <th className="px-5 py-3">Xero Journal #</th>
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
                        <a
                          href={`https://go.xero.com/Journal/View.aspx?invoiceID=${entry.xeroManualJournalId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#6d69ff] hover:text-[#5a56e6] transition-colors hover:underline"
                          title="Open in Xero"
                        >
                          Posted Manual Journal #{entry.xeroJournalNumber || entry.id}
                        </a>
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

        {/* Audit Trail Section */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md hover:border-gray-300">
          <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
            <h3 className="text-sm font-semibold text-gray-700">Audit Trail</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="px-5 py-2">Date & Time</th>
                  <th className="px-5 py-2">Action</th>
                  <th className="px-5 py-2">Description</th>
                  <th className="px-5 py-2">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {auditTrail.length > 0 ? (
                  auditTrail.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-2">
                        <span className="text-xs text-gray-600">
                          {new Date(entry.date).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}, {new Date(entry.date).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </span>
                      </td>
                      <td className="px-5 py-2">
                        <span className="text-xs text-gray-700">{entry.action}</span>
                      </td>
                      <td className="px-5 py-2">
                        <span className="text-xs text-gray-900">{entry.description}</span>
                        {(entry.userName || entry.userId) && (
                          <span className="text-xs text-gray-500 ml-2">
                            by {entry.userName || `User ID: ${entry.userId}`}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-2">
                        <span className="text-xs text-gray-600 font-mono">{entry.details || '-'}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <Clock className="w-8 h-8 text-gray-300" />
                        <p className="text-xs">No audit trail entries available.</p>
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

