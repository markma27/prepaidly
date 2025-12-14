'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { scheduleApi, journalApi } from '@/lib/api';
import { formatDate, formatCurrency } from '@/lib/utils';
import type { Schedule, JournalEntry } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import SuccessMessage from '@/components/SuccessMessage';

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [postingJournalId, setPostingJournalId] = useState<number | null>(null);
  const [tenantId, setTenantId] = useState<string>('');

  useEffect(() => {
    const tenantIdParam = searchParams.get('tenantId');
    const success = searchParams.get('success');

    if (success === 'true') {
      // Show success message briefly
      setTimeout(() => {
        // Remove success param from URL
        router.replace(`/app/dashboard?tenantId=${tenantIdParam}`);
      }, 3000);
    }

    if (tenantIdParam) {
      setTenantId(tenantIdParam);
      loadSchedules(tenantIdParam);
    } else {
      setError('Missing Tenant ID');
      setLoading(false);
    }
  }, [searchParams, router]);

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

  const handlePostJournal = async (journalEntryId: number) => {
    if (!tenantId) {
      setError('Missing Tenant ID');
      return;
    }

    if (!confirm('Are you sure you want to post this journal entry to Xero?')) {
      return;
    }

    try {
      setPostingJournalId(journalEntryId);
      setError(null);

      await journalApi.postJournal({
        journalEntryId,
        tenantId,
      });

      // Reload schedules to get updated status
      await loadSchedules(tenantId);
      
      alert('Journal entry successfully posted to Xero!');
    } catch (err: any) {
      console.error('Error posting journal:', err);
      setError(err.message || 'Failed to post journal entry');
    } finally {
      setPostingJournalId(null);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <LoadingSpinner message="Loading schedule data..." />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="flex gap-4">
          <button
            onClick={() => router.push(`/app/schedules/new?tenantId=${tenantId}`)}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            Create New Schedule
          </button>
          <button
            onClick={() => tenantId && loadSchedules(tenantId)}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {searchParams.get('success') === 'true' && (
        <SuccessMessage 
          message="Schedule created successfully!" 
          onDismiss={() => router.replace(`/app/dashboard?tenantId=${tenantId}`)}
        />
      )}

      {error && (
        <ErrorMessage 
          message={error} 
          onDismiss={() => setError(null)}
        />
      )}

      {schedules.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <p className="text-gray-600 mb-4">No schedules created yet</p>
          <button
            onClick={() => router.push(`/app/schedules/new?tenantId=${tenantId}`)}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Create Your First Schedule
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {schedules.map((schedule) => (
            <div key={schedule.id} className="bg-white shadow rounded-lg overflow-hidden">
              {/* Schedule Header */}
              <div className="bg-gray-50 px-6 py-4 border-b">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-xl font-semibold">
                        {schedule.type === 'PREPAID' ? 'Prepaid Expense' : 'Unearned Revenue'}
                      </h2>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                        ID: {schedule.id}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Date Range: </span>
                        <span className="font-medium">
                          {formatDate(schedule.startDate)} - {formatDate(schedule.endDate)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Total Amount: </span>
                        <span className="font-medium">{formatCurrency(schedule.totalAmount)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Remaining Balance: </span>
                        <span className="font-medium">
                          {formatCurrency(schedule.remainingBalance || 0)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Progress: </span>
                        <span className="font-medium">
                          {schedule.postedPeriods || 0} / {schedule.totalPeriods || 0} periods
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-gray-600">
                      <span>Account Codes: </span>
                      {schedule.type === 'PREPAID' && schedule.expenseAcctCode && (
                        <span className="mr-4">Expense: {schedule.expenseAcctCode}</span>
                      )}
                      {schedule.type === 'UNEARNED' && schedule.revenueAcctCode && (
                        <span className="mr-4">Revenue: {schedule.revenueAcctCode}</span>
                      )}
                      <span>Deferral: {schedule.deferralAcctCode}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Journal Entries */}
              <div className="px-6 py-4">
                <h3 className="text-lg font-semibold mb-4">Journal Entries</h3>
                {schedule.journalEntries && schedule.journalEntries.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Period Date
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Amount
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Status
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Xero Journal ID
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {schedule.journalEntries.map((entry) => (
                          <tr key={entry.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              {formatDate(entry.periodDate)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                              {formatCurrency(entry.amount)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {entry.posted ? (
                                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                                  Posted
                                </span>
                              ) : (
                                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">
                                  Not Posted
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                              {entry.xeroManualJournalId || '-'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                              {!entry.posted ? (
                                <button
                                  onClick={() => handlePostJournal(entry.id)}
                                  disabled={postingJournalId === entry.id}
                                  className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-xs"
                                >
                                  {postingJournalId === entry.id ? 'Posting...' : 'Post to Xero'}
                                </button>
                              ) : (
                                <span className="text-gray-400 text-xs">Posted</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No journal entries available</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

