'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { scheduleApi } from '@/lib/api';
import { formatDate, formatCurrency } from '@/lib/utils';
import type { Schedule } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import DashboardLayout from '@/components/DashboardLayout';
import Skeleton from '@/components/Skeleton';
import { ArrowRight, Calendar, DollarSign } from 'lucide-react';

function ScheduleRegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string>('');

  useEffect(() => {
    const tenantIdParam = searchParams.get('tenantId');
    if (tenantIdParam) {
      setTenantId(tenantIdParam);
      loadSchedules(tenantIdParam);
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

  const handleRowClick = (scheduleId: number) => {
    router.push(`/app/schedules/${scheduleId}?tenantId=${tenantId}`);
  };

  if (loading && !tenantId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner message="Loading..." />
      </div>
    );
  }

  return (
    <DashboardLayout tenantId={tenantId}>
      <div className="space-y-7 max-w-[1440px] mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900">Schedule Register</h2>
              <p className="text-xs text-gray-500 mt-0.5">All prepayment and unearned revenue schedules</p>
            </div>
          </div>
        </div>

        {/* Schedules Table */}
        {error ? (
          <ErrorMessage message={error} />
        ) : loading ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="px-5 py-3"><div className="h-3 w-12 bg-gray-200 rounded animate-pulse"></div></th>
                    <th className="px-5 py-3"><div className="h-3 w-16 bg-gray-200 rounded animate-pulse"></div></th>
                    <th className="px-5 py-3"><div className="h-3 w-16 bg-gray-200 rounded animate-pulse"></div></th>
                    <th className="px-5 py-3"><div className="h-3 w-24 bg-gray-200 rounded animate-pulse"></div></th>
                    <th className="px-5 py-3"><div className="h-3 w-16 bg-gray-200 rounded animate-pulse"></div></th>
                    <th className="px-5 py-3"><div className="h-3 w-20 bg-gray-200 rounded animate-pulse"></div></th>
                    <th className="px-5 py-3"><div className="h-3 w-4 bg-gray-200 rounded animate-pulse"></div></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                    <tr key={i}>
                      <td className="px-5 py-3"><Skeleton className="h-5 w-20" variant="rectangular" /></td>
                      <td className="px-5 py-3">
                        <Skeleton className="h-4 w-24 mb-1" variant="text" />
                        <Skeleton className="h-3 w-32" variant="text" />
                      </td>
                      <td className="px-5 py-3">
                        <Skeleton className="h-4 w-32 mb-1" variant="text" />
                        <Skeleton className="h-3 w-24" variant="text" />
                      </td>
                      <td className="px-5 py-3">
                        <Skeleton className="h-4 w-20 mb-1" variant="text" />
                        <Skeleton className="h-3 w-24" variant="text" />
                      </td>
                      <td className="px-5 py-3"><Skeleton className="h-5 w-16" variant="rectangular" /></td>
                      <td className="px-5 py-3"><Skeleton className="h-4 w-24" variant="text" /></td>
                      <td className="px-5 py-3"><Skeleton className="h-4 w-4" variant="circular" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md hover:border-gray-300">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Amount</th>
                    <th className="px-5 py-3">Period</th>
                    <th className="px-5 py-3">Account Code</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Created Date</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {schedules.map((schedule) => {
                    const postedCount = schedule.postedPeriods || 0;
                    const totalCount = schedule.totalPeriods || 0;
                    const isComplete = postedCount === totalCount && totalCount > 0;
                    
                    return (
                      <tr
                        key={schedule.id}
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => handleRowClick(schedule.id)}
                      >
                        <td className="px-5 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                              schedule.type === 'PREPAID'
                                ? 'bg-blue-50 text-blue-600'
                                : 'bg-green-50 text-green-600'
                            }`}
                          >
                            {schedule.type === 'PREPAID' ? 'Prepaid Expense' : 'Unearned Revenue'}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="text-sm font-bold text-gray-900">{formatCurrency(schedule.totalAmount)}</div>
                          {schedule.remainingBalance !== undefined && (
                            <div className="text-xs text-gray-500">
                              Remaining: {formatCurrency(schedule.remainingBalance)}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <div className="text-sm text-gray-900">
                            {formatDate(schedule.startDate)} - {formatDate(schedule.endDate)}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {totalCount} {totalCount === 1 ? 'period' : 'periods'}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <div className="text-sm text-gray-900">
                            {schedule.type === 'PREPAID' ? schedule.expenseAcctCode : schedule.revenueAcctCode}
                          </div>
                          <div className="text-xs text-gray-500">
                            {schedule.deferralAcctCode} (Deferral)
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            {isComplete ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-green-100 text-green-700">
                                Complete
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-yellow-100 text-yellow-700">
                                {postedCount}/{totalCount} Posted
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-sm text-gray-500">{formatDate(schedule.createdAt)}</td>
                        <td className="px-5 py-3">
                          <ArrowRight className="w-4 h-4 text-gray-400" />
                        </td>
                      </tr>
                    );
                  })}
                  {schedules.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                        <div className="flex flex-col items-center gap-2">
                          <Calendar className="w-8 h-8 text-gray-300" />
                          <p>No schedules found.</p>
                          <p className="text-xs">Create your first schedule to see it here.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default function ScheduleRegisterPage() {
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
      <ScheduleRegisterContent />
    </Suspense>
  );
}

