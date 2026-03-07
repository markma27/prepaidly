'use client';

import { Suspense, useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { scheduleApi, journalApi, xeroApi } from '@/lib/api';
import { formatDateOnly, formatDateInTimezone, formatTimestampInTimezone, formatCurrency } from '@/lib/utils';
import { getOrgTimezone, getOrgCurrency } from '@/lib/OrgContext';
import type { Schedule, JournalEntry, XeroAccount } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import DashboardLayout from '@/components/DashboardLayout';
import ScheduleDetailSkeleton from '@/components/ScheduleDetailSkeleton';
import { ArrowLeft, Calendar, DollarSign, CheckCircle, XCircle, Upload, Loader2, ExternalLink, Clock, User, FileText, FileDown, Ban, AlertTriangle, Pencil } from 'lucide-react';
import * as XLSX from 'xlsx';
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
  const [accounts, setAccounts] = useState<XeroAccount[]>([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);
  const [voidWarning, setVoidWarning] = useState<string | null>(null);
  const [voidSuccessMessage, setVoidSuccessMessage] = useState<string | null>(null);
  const [showWriteOffModal, setShowWriteOffModal] = useState(false);
  const [writeOffDate, setWriteOffDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [writeOffSubmitting, setWriteOffSubmitting] = useState(false);
  const [writeOffError, setWriteOffError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editContactName, setEditContactName] = useState('');
  const [editInvoiceReference, setEditInvoiceReference] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const scheduleId = params?.id ? parseInt(params.id as string) : null;
  
  // Get org currency for formatting
  const orgCurrency = getOrgCurrency(tenantId) || 'USD';

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
        details: `Type: ${schedule.type === 'PREPAID' ? 'Prepayment' : 'Unearned Revenue'}, Amount: ${formatCurrency(schedule.totalAmount, orgCurrency)}`
      });
    }

    // Journal entry postings (only posted entries)
    // Note: Backend doesn't currently track postedBy, so we show current user if available
    // For historical posts, user info won't be available until backend is updated
    journalEntries
      .filter(entry => entry.posted && entry.xeroManualJournalId)
      .sort((a, b) => {
        // Sort by postedAt if available, otherwise by createdAt
        const dateA = a.postedAt ? new Date(a.postedAt).getTime() : new Date(a.createdAt).getTime();
        const dateB = b.postedAt ? new Date(b.postedAt).getTime() : new Date(b.createdAt).getTime();
        return dateA - dateB;
      })
      .forEach(entry => {
        const postDate = entry.postedAt || entry.updatedAt || entry.createdAt;
        trail.push({
          id: `journal-posted-${entry.id}`,
          date: postDate,
          action: entry.writeOff ? 'Write-off posted' : 'Journal Posted',
          description: entry.writeOff
            ? `Write-off (full recognition) for ${formatDateOnly(entry.periodDate)} posted to Xero`
            : `Journal entry for ${formatDateOnly(entry.periodDate)} posted to Xero`,
          userName: currentUserName || undefined,
          userId: currentUserId || undefined,
          details: `Amount: ${formatCurrency(entry.amount, orgCurrency)}, Xero Journal ID: ${entry.xeroManualJournalId}`
        });
      });

    // Sort by date (newest first)
    return trail.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [schedule, currentUserName, currentUserId]);

  // Account code → name lookup for expense/revenue display
  const accountMap = useMemo(() => {
    const map = new Map<string, string>();
    accounts.forEach(account => {
      if (account.code) map.set(account.code, account.name);
    });
    return map;
  }, [accounts]);

  // Journal entries: period-only list and write-off entry (must run before any early return)
  const journalEntries = schedule?.journalEntries ?? [];
  const periodEntries = useMemo(() =>
    [...journalEntries].filter((e) => !e.writeOff).sort((a, b) =>
      new Date(a.periodDate).getTime() - new Date(b.periodDate).getTime()
    ),
    [journalEntries]
  );
  const writeOffEntry = useMemo(
    () => journalEntries.find((e) => e.writeOff),
    [journalEntries]
  );
  const isCompleted = Boolean(
    schedule && !schedule.voided && schedule.remainingBalance != null && schedule.remainingBalance <= 0
  );

  // Minimum write-off date: day after the most recently posted (period) journal date
  const minWriteOffDate = useMemo(() => {
    const postedPeriodEntries = journalEntries.filter((e) => !e.writeOff && e.posted);
    if (postedPeriodEntries.length === 0) return undefined;
    const maxDate = postedPeriodEntries.reduce((max, e) => {
      const d = new Date(e.periodDate);
      return d > max ? d : max;
    }, new Date(0));
    const next = new Date(maxDate);
    next.setDate(next.getDate() + 1);
    return next.toISOString().slice(0, 10);
  }, [journalEntries]);

  const getAccountDisplay = (code: string | undefined, typeLabel: string): string => {
    if (!code) return '—';
    const name = accountMap.get(code);
    if (accountsLoaded && name) return `${code} - ${name}`;
    return `${code} (${typeLabel})`;
  };

  useEffect(() => {
    const tenantIdParam = searchParams.get('tenantId');
    if (tenantIdParam && scheduleId) {
      setTenantId(tenantIdParam);
      setLoading(true);
      setError(null);
      (async () => {
        try {
          const [scheduleData] = await Promise.all([
            scheduleApi.getSchedule(scheduleId),
            loadAccounts(tenantIdParam),
          ]);
          setSchedule(scheduleData);
        } catch (err: any) {
          console.error('Error loading schedule:', err);
          setError(err.message || 'Failed to load schedule');
        } finally {
          setLoading(false);
        }
      })();
    } else {
      setError('Missing Tenant ID or Schedule ID');
      setLoading(false);
    }
  }, [searchParams, scheduleId]);

  const loadAccounts = async (tid: string) => {
    try {
      const response = await xeroApi.getAccounts(tid);
      setAccounts(response.accounts || []);
      setAccountsLoaded(true);
    } catch (err: any) {
      console.error('Error loading accounts:', err);
      setAccountsLoaded(true);
    }
  };

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

  const handleExportToExcel = () => {
    if (!schedule) return;

    const wb = XLSX.utils.book_new();

    // Sheet 1: Schedule Details
    const detailsData: (string | number)[][] = [
      ['Schedule Details', ''],
      ['Type', schedule.type === 'PREPAID' ? 'Prepayment' : 'Unearned Revenue'],
      ['Contact', schedule.contactName || ''],
      ['Total Amount', formatCurrency(schedule.totalAmount, orgCurrency)],
      ['Remaining', schedule.remainingBalance !== undefined ? formatCurrency(schedule.remainingBalance, orgCurrency) : ''],
      ['Start Date', formatDateOnly(schedule.startDate)],
      ['End Date', formatDateOnly(schedule.endDate)],
      ['Periods', `${schedule.postedPeriods || 0} / ${schedule.totalPeriods || 0}`],
      ['Status', schedule.postedPeriods === schedule.totalPeriods && schedule.totalPeriods ? 'Complete' : 'In Progress'],
      [schedule.type === 'PREPAID' ? 'Expense Account' : 'Revenue Account', getAccountDisplay(schedule.type === 'PREPAID' ? schedule.expenseAcctCode : schedule.revenueAcctCode, schedule.type === 'PREPAID' ? 'Expense' : 'Revenue')],
      ['Invoice Date', schedule.invoiceDate ? formatDateOnly(schedule.invoiceDate) : ''],
      ['Invoice Reference', schedule.invoiceReference || ''],
      ['Description', schedule.description || ''],
    ];
    const wsDetails = XLSX.utils.aoa_to_sheet(detailsData);
    wsDetails['!cols'] = [{ wch: 22 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, wsDetails, 'Schedule Details');

    // Sheet 2: Journal Entries (period entries + write-off, sorted by date)
    const entriesForExport = [...(schedule.journalEntries || [])].sort(
      (a, b) => new Date(a.periodDate).getTime() - new Date(b.periodDate).getTime()
    );
    const journalData: (string | number)[][] = [
      ['Period Date', 'Amount', 'Status', 'Xero Journal #'],
      ...entriesForExport.map((entry: JournalEntry) => [
        formatDateOnly(entry.periodDate) + (entry.writeOff ? ' (Write-off)' : ''),
        formatCurrency(entry.amount, orgCurrency),
        entry.posted ? 'Posted' : 'Pending',
        entry.xeroManualJournalId ? `#${entry.xeroJournalNumber || entry.id}` : '-',
      ]),
    ];
    const wsJournal = XLSX.utils.aoa_to_sheet(journalData);
    wsJournal['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsJournal, 'Journal Entries');

    // Sheet 3: Audit Trail
    const auditData: (string | number)[][] = [
      ['Date & Time', 'Action', 'Description', 'Details'],
      ...auditTrail.map((entry) => [
        formatTimestampInTimezone(entry.date, getOrgTimezone(tenantId), { includeTime: true, includeSeconds: true }),
        entry.action,
        entry.description + ((entry.userName || entry.userId) ? ` by ${entry.userName || `User ID: ${entry.userId}`}` : ''),
        entry.details || '-',
      ]),
    ];
    const wsAudit = XLSX.utils.aoa_to_sheet(auditData);
    wsAudit['!cols'] = [{ wch: 22 }, { wch: 18 }, { wch: 50 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, wsAudit, 'Audit Trail');

    const filename = `Schedule_${schedule.id}_${schedule.contactName?.replace(/\s+/g, '_') || 'Export'}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  const handleVoidConfirm = async () => {
    if (!scheduleId || !schedule || schedule.voided || !tenantId) return;
    
    setVoidError(null);
    setVoidWarning(null);
    
    try {
      setVoiding(true);
      
      // Use the new endpoint that also voids journals in Xero
      const response = await scheduleApi.voidScheduleWithJournals(scheduleId, tenantId);
      
      if (!response.success) {
        // Failed - could be locked period, or other void error
        setVoidError(response.message);
        return;
      }
      
      // Success - update schedule and close modal
      if (response.schedule) {
        setSchedule(response.schedule);
      }
      
      // Show success popup with journal count
      const journalCount = response.voidedJournalIds?.length ?? 0;
      const successMsg = journalCount > 0
        ? `Schedule voided and ${journalCount} journal${journalCount === 1 ? '' : 's'} voided in Xero.`
        : 'Schedule voided successfully.';
      setVoidSuccessMessage(successMsg);
      
      // Show info message if there are any notes (e.g., journals not found in Xero)
      if (response.message && (response.message.includes('Note:') || response.message.includes('Warning:'))) {
        setVoidWarning(response.message);
      }
      
      setShowVoidModal(false);
    } catch (err: any) {
      console.error('Error voiding schedule:', err);
      // Check if response contains detailed error message
      const errorData = err.data;
      if (errorData?.message) {
        setVoidError(errorData.message);
      } else {
        setVoidError(err.message || 'Failed to void schedule');
      }
    } finally {
      setVoiding(false);
    }
  };

  const handleWriteOffConfirm = async () => {
    if (!scheduleId || !tenantId || !writeOffDate) return;
    setWriteOffError(null);
    try {
      setWriteOffSubmitting(true);
      const updated = await scheduleApi.fullyRecognise(scheduleId, tenantId, writeOffDate);
      setSchedule(updated);
      setShowWriteOffModal(false);
    } catch (err: any) {
      console.error('Error fully recognising schedule:', err);
      const msg = err?.data?.error ?? err?.message ?? 'Failed to post write-off to Xero';
      setWriteOffError(msg);
    } finally {
      setWriteOffSubmitting(false);
    }
  };

  const handleEditPartialSubmit = async () => {
    if (!scheduleId || !tenantId) return;
    if (!editContactName.trim()) {
      setEditError('Contact is required');
      return;
    }
    if (!editInvoiceReference.trim()) {
      setEditError('Invoice reference is required');
      return;
    }
    setEditError(null);
    try {
      setEditSubmitting(true);
      const updated = await scheduleApi.updateSchedulePartial(scheduleId, tenantId, {
        contactName: editContactName.trim(),
        invoiceReference: editInvoiceReference.trim(),
        description: editDescription.trim() || undefined,
      });
      setSchedule(updated);
      setShowEditModal(false);
    } catch (err: any) {
      console.error('Error updating schedule:', err);
      setEditError(err?.data?.error ?? err?.message ?? 'Failed to update schedule');
    } finally {
      setEditSubmitting(false);
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

  return (
    <DashboardLayout tenantId={tenantId}>
      <>
      <div className="space-y-7 max-w-[1800px] mx-auto">
        {/* Top bar: Back button (left) + Void + Export (right) */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push(`/app/schedules/register?tenantId=${tenantId}`)}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Schedule Register
          </button>
          <div className="flex items-center gap-2">
            {!schedule.voided && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const hasAnyPosted = (schedule.postedPeriods ?? 0) > 0;
                    if (!hasAnyPosted) {
                      router.push(`/app/schedules/${schedule.id}/edit?tenantId=${tenantId}`);
                    } else {
                      setEditContactName(schedule.contactName ?? '');
                      setEditInvoiceReference(schedule.invoiceReference ?? '');
                      setEditDescription(schedule.description ?? '');
                      setEditError(null);
                      setShowEditModal(true);
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                  Edit Schedule
                </button>
                <button
                  type="button"
                  onClick={() => setShowVoidModal(true)}
                  disabled={voiding}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  {voiding ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Ban className="w-4 h-4" />
                  )}
                  Void schedule
                </button>
                {!isCompleted && schedule.remainingBalance != null && schedule.remainingBalance > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setWriteOffError(null);
                      const today = new Date().toISOString().slice(0, 10);
                      const min = minWriteOffDate;
                      setWriteOffDate(min && today < min ? min : today);
                      setShowWriteOffModal(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-900 bg-amber-100 rounded-lg hover:bg-amber-200 transition-colors"
                  >
                    Fully Recognise (write off)
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              onClick={handleExportToExcel}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-800 bg-green-100 rounded-lg hover:bg-green-200 transition-colors"
            >
              <FileDown className="w-4 h-4" />
              Export to Excel
            </button>
          </div>
        </div>

        {/* Warning banner for partial void success */}
        {voidWarning && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-amber-800 font-medium">Void completed with warnings</p>
              <p className="text-sm text-amber-700 mt-1">{voidWarning}</p>
            </div>
            <button
              onClick={() => setVoidWarning(null)}
              className="text-amber-600 hover:text-amber-800"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        )}

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
                  {schedule.type === 'PREPAID' ? 'Prepayment' : 'Unearned Revenue'}
                </span>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Total Amount</div>
                <div className="text-sm font-bold text-gray-900">{formatCurrency(schedule.totalAmount, orgCurrency)}</div>
                {schedule.remainingBalance !== undefined && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    Remaining: {formatCurrency(schedule.remainingBalance, orgCurrency)}
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Period</div>
                <div className="text-sm text-gray-900">
                  {formatDateOnly(schedule.startDate)} - {formatDateOnly(schedule.endDate)}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {schedule.totalPeriods || 0} {schedule.totalPeriods === 1 ? 'period' : 'periods'}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Status</div>
                {schedule.voided ? (
                  <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold bg-red-100 text-red-700">
                    Voided
                  </span>
                ) : isCompleted ? (
                  <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold bg-green-100 text-green-700">
                    Completed
                  </span>
                ) : schedule.postedPeriods === schedule.totalPeriods && schedule.totalPeriods ? (
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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Contact</div>
                  <div className="text-sm text-gray-900">{schedule.contactName || '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">
                    {schedule.type === 'PREPAID' ? 'Expense Account' : 'Revenue Account'}
                  </div>
                  <div className="text-sm text-gray-900">
                    {getAccountDisplay(
                      schedule.type === 'PREPAID' ? schedule.expenseAcctCode : schedule.revenueAcctCode,
                      schedule.type === 'PREPAID' ? 'Expense' : 'Revenue'
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Invoice date</div>
                  <div className="text-sm text-gray-900">
                    {schedule.invoiceDate ? formatDateOnly(schedule.invoiceDate) : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Invoice reference</div>
                  <div className="text-sm text-gray-900">{schedule.invoiceReference || '—'}</div>
                </div>
                <div className="md:col-span-4">
                  <div className="text-xs text-gray-500 mb-1">Description</div>
                  <div className="text-sm text-gray-900">{schedule.description || '—'}</div>
                </div>
              </div>
              {schedule.invoiceUrl && (
                <div className="mt-5">
                  <div className="text-xs text-gray-500 mb-1">Invoice</div>
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#6d69ff]" />
                    <a
                      href={schedule.invoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#6d69ff] hover:text-[#5a56e6] hover:underline transition-colors"
                    >
                      {schedule.invoiceFilename || 'View Invoice'}
                    </a>
                  </div>
                  {schedule.invoiceUrl.match(/\.(jpg|jpeg|png)$/i) && (
                    <div className="mt-2 rounded-lg overflow-hidden border border-gray-200 max-w-xs">
                      <img
                        src={schedule.invoiceUrl}
                        alt="Invoice"
                        className="w-full h-auto max-h-48 object-contain bg-gray-50"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Journal Entries Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md hover:border-gray-300">
          <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
            <h3 className="text-base font-bold text-gray-900">Journal Entries</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {periodEntries.length + (writeOffEntry ? 1 : 0)} {periodEntries.length + (writeOffEntry ? 1 : 0) === 1 ? 'entry' : 'entries'} total
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
                {periodEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="text-sm font-medium text-gray-900">{formatDateOnly(entry.periodDate)}</div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-sm font-bold text-gray-900">{formatCurrency(entry.amount, orgCurrency)}</div>
                    </td>
                    <td className="px-5 py-3">
                      {schedule.voided && entry.posted && entry.xeroManualJournalId ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-red-100 text-red-700">
                          <Ban className="w-3 h-3" />
                          Voided
                        </span>
                      ) : entry.posted ? (
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
                      {schedule.voided && entry.posted && entry.xeroManualJournalId ? (
                        <span className="text-xs text-gray-400">Voided</span>
                      ) : entry.posted ? (
                        <span className="text-xs text-gray-400">Already posted</span>
                      ) : (
                        <button
                          onClick={(e) => handlePostJournal(entry, e)}
                          disabled={posting.has(entry.id) || schedule.voided || isCompleted}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            schedule.voided || isCompleted
                              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                              : 'text-white bg-[#6d69ff] hover:bg-[#5a56e6]'
                          }`}
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
                {writeOffEntry && (
                  <>
                    <tr className="bg-gray-50" aria-hidden>
                      <td colSpan={5} className="px-5 py-0 h-0 border-t border-gray-200" />
                    </tr>
                    <tr className="hover:bg-gray-50 transition-colors bg-amber-50/30">
                      <td className="px-5 py-3">
                        <div className="text-sm font-medium text-gray-900">{formatDateOnly(writeOffEntry.periodDate)}</div>
                        <div className="text-[10px] text-amber-700 font-medium mt-0.5">Write-off</div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="text-sm font-bold text-gray-900">{formatCurrency(writeOffEntry.amount, orgCurrency)}</div>
                      </td>
                      <td className="px-5 py-3">
                        {writeOffEntry.posted ? (
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
                        {writeOffEntry.xeroManualJournalId ? (
                          <a
                            href={`https://go.xero.com/Journal/View.aspx?invoiceID=${writeOffEntry.xeroManualJournalId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[#6d69ff] hover:text-[#5a56e6] transition-colors hover:underline"
                            title="Open in Xero"
                          >
                            Posted Manual Journal #{writeOffEntry.xeroJournalNumber || writeOffEntry.id}
                          </a>
                        ) : (
                          <div className="text-xs text-gray-400">-</div>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {writeOffEntry.posted ? (
                          <span className="text-xs text-gray-400">Already posted</span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  </>
                )}
                {periodEntries.length === 0 && !writeOffEntry && (
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
                          {formatTimestampInTimezone(entry.date, getOrgTimezone(tenantId), {
                            includeTime: true,
                            includeSeconds: true,
                            includeWeekday: true
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

      {/* Void confirmation modal */}
      {showVoidModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !voiding && !voidError && setShowVoidModal(false)}
            aria-hidden
          />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-gray-200">
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                voidError ? 'bg-amber-100' : 'bg-red-100'
              }`}>
                <Ban className={`w-6 h-6 ${voidError ? 'text-amber-600' : 'text-red-600'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900">
                  {voidError ? 'Cannot Void Schedule' : 'Void Schedule'}
                </h3>
                
                {voidError ? (
                  <>
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-800">{voidError}</p>
                    </div>
                    {voidError.toLowerCase().includes('locked') ? (
                      <p className="mt-3 text-sm text-gray-500">
                        Please unlock the accounting period in Xero and try again.
                      </p>
                    ) : (
                      <p className="mt-3 text-sm text-gray-500">
                        Please check the journal in Xero and try again.
                      </p>
                    )}
                    <div className="mt-6 flex gap-3 justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setVoidError(null);
                          setShowVoidModal(false);
                        }}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-sm text-gray-600">
                      Are you sure you want to void this schedule?
                    </p>
                    
                    {/* Show info about Xero journals if any are posted */}
                    {schedule?.journalEntries?.some(e => e.posted && e.xeroManualJournalId) && (
                      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                        <p className="text-sm text-blue-800">
                          <strong>How this works:</strong> The app will void each posted journal in Xero, then mark this schedule as voided. The schedule will be hidden from Analytics and Register.
                        </p>
                        <p className="text-sm text-blue-800">
                          <strong>Locked period:</strong> If any journal&apos;s accounting period is locked in Xero, the void will fail and the schedule will stay active. Unlock the period in Xero first, then try again.
                        </p>
                        <p className="text-sm text-blue-800">
                          <strong>Already voided:</strong> Journals already voided in Xero (e.g. manually) are skipped and do not block this action.
                        </p>
                      </div>
                    )}
                    
                    <div className="mt-6 flex gap-3 justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setVoidError(null);
                          setShowVoidModal(false);
                        }}
                        disabled={voiding}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleVoidConfirm}
                        disabled={voiding}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {voiding ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Voiding...
                          </>
                        ) : (
                          'Void Schedule'
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fully Recognise (write off) modal */}
      {showWriteOffModal && schedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !writeOffSubmitting && setShowWriteOffModal(false)}
            aria-hidden
          />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-gray-200">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#6d69ff]/10 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-[#6d69ff]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900">Fully Recognise (write off)</h3>
                <p className="mt-2 text-sm text-gray-600">
                  Post the remaining {formatCurrency(schedule.remainingBalance ?? 0, orgCurrency)} to Xero in one journal entry on the date you choose. The schedule will be marked as Completed and pending Post to Xero buttons will be disabled.
                </p>
                {writeOffError && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800">{writeOffError}</p>
                  </div>
                )}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Write-off date</label>
                  <input
                    type="date"
                    value={writeOffDate}
                    min={minWriteOffDate}
                    onChange={(e) => setWriteOffDate(e.target.value)}
                    className="w-full h-10 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6d69ff] focus:border-transparent text-sm text-gray-900"
                  />
                  {minWriteOffDate && (
                    <p className="text-xs text-gray-500 mt-1">
                      Must be after the most recently posted journal date.
                    </p>
                  )}
                </div>
                <div className="mt-6 flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowWriteOffModal(false)}
                    disabled={writeOffSubmitting}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleWriteOffConfirm}
                    disabled={writeOffSubmitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-[#6d69ff] rounded-lg hover:bg-[#5a56e6] transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {writeOffSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Posting...
                      </>
                    ) : (
                      'Post write-off to Xero'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Schedule (partial) modal - Contact, Invoice Reference, Description only */}
      {showEditModal && schedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !editSubmitting && setShowEditModal(false)}
            aria-hidden
          />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-gray-200">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Pencil className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900">Edit Schedule</h3>
                <p className="mt-2 text-sm text-gray-600">
                  Some journals have been posted. You can only update Contact, Invoice Reference, and Description.
                </p>
                {editError && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">{editError}</p>
                  </div>
                )}
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Contact</label>
                    <input
                      type="text"
                      value={editContactName}
                      onChange={(e) => setEditContactName(e.target.value)}
                      className="w-full h-10 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
                      placeholder="Contact name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Invoice Reference</label>
                    <input
                      type="text"
                      value={editInvoiceReference}
                      onChange={(e) => setEditInvoiceReference(e.target.value)}
                      className="w-full h-10 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
                      placeholder="Invoice reference"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Description (optional)</label>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900 placeholder:text-gray-400"
                      placeholder="Description or notes"
                    />
                  </div>
                </div>
                <div className="mt-6 flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    disabled={editSubmitting}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleEditPartialSubmit}
                    disabled={editSubmitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {editSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Void success popup */}
      {voidSuccessMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setVoidSuccessMessage(null)}
            aria-hidden
          />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-gray-200">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900">Schedule Voided</h3>
                <p className="mt-2 text-sm text-gray-600">{voidSuccessMessage}</p>
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setVoidSuccessMessage(null)}
                    className="px-4 py-2 text-sm font-medium text-white bg-[#6d69ff] rounded-lg hover:bg-[#5a56e6] transition-colors"
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </>
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

