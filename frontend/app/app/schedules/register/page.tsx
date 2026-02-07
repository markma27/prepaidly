'use client';

import { Suspense, useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { scheduleApi, xeroApi } from '@/lib/api';
import { formatDate, formatCurrency } from '@/lib/utils';
import type { Schedule, XeroAccount } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import DashboardLayout from '@/components/DashboardLayout';
import Skeleton from '@/components/Skeleton';
import { Calendar, DollarSign, Search } from 'lucide-react';

function ScheduleRegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [accounts, setAccounts] = useState<XeroAccount[]>([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    const tenantIdParam = searchParams.get('tenantId');
    if (tenantIdParam) {
      setTenantId(tenantIdParam);
      Promise.all([
        loadSchedules(tenantIdParam),
        loadAccounts(tenantIdParam)
      ]);
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
      setAccountsLoaded(true);
    } catch (err: any) {
      console.error('Error loading accounts:', err);
      // Mark as loaded even on error to prevent infinite loading state
      setAccountsLoaded(true);
    }
  };

  const handleRowClick = (scheduleId: number) => {
    router.push(`/app/schedules/${scheduleId}?tenantId=${tenantId}`);
  };

  // Create a lookup map for accounts by code
  const accountMap = useMemo(() => {
    const map = new Map<string, string>();
    accounts.forEach(account => {
      if (account.code) {
        map.set(account.code, account.name);
      }
    });
    return map;
  }, [accounts]);

  // Helper function to get account name by code
  const getAccountName = (code: string | undefined): string => {
    if (!code) return '';
    return accountMap.get(code) || '';
  };

  // Filter schedules based on search query
  const filteredSchedules = useMemo(() => {
    if (!searchQuery.trim()) {
      return schedules;
    }

    const query = searchQuery.toLowerCase().trim();
    return schedules.filter(schedule => {
      // Search by type
      const typeMatch = schedule.type.toLowerCase().includes(query) ||
        (schedule.type === 'PREPAID' ? 'prepayment' : 'unearned revenue').includes(query);
      
      // Search by account codes
      const expenseCode = schedule.expenseAcctCode?.toLowerCase() || '';
      const revenueCode = schedule.revenueAcctCode?.toLowerCase() || '';
      const deferralCode = schedule.deferralAcctCode?.toLowerCase() || '';
      const accountCodeMatch = expenseCode.includes(query) || 
                               revenueCode.includes(query) || 
                               deferralCode.includes(query);
      
      // Search by account names
      const expenseName = getAccountName(schedule.expenseAcctCode).toLowerCase();
      const revenueName = getAccountName(schedule.revenueAcctCode).toLowerCase();
      const accountNameMatch = expenseName.includes(query) || revenueName.includes(query);
      
      // Search by amount
      const amountStr = formatCurrency(schedule.totalAmount).toLowerCase();
      const remainingStr = schedule.remainingBalance !== undefined 
        ? formatCurrency(schedule.remainingBalance).toLowerCase() 
        : '';
      const amountMatch = amountStr.includes(query) || remainingStr.includes(query);
      
      // Search by contact name
      const contactNameStr = schedule.contactName?.toLowerCase() || '';
      const contactMatch = contactNameStr.includes(query);

      // Search by dates
      const startDate = formatDate(schedule.startDate).toLowerCase();
      const endDate = formatDate(schedule.endDate).toLowerCase();
      const createdDate = formatDate(schedule.createdAt).toLowerCase();
      const dateMatch = startDate.includes(query) || endDate.includes(query) || createdDate.includes(query);
      
      return typeMatch || accountCodeMatch || accountNameMatch || amountMatch || contactMatch || dateMatch;
    });
  }, [schedules, searchQuery, accountMap]);

  if (loading && !tenantId) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-8">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden w-full max-w-[500px]">
          <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
            <h3 className="text-base font-bold text-gray-900">Schedules</h3>
            <p className="text-xs text-gray-500 mt-0.5">Search and view all prepayment and unearned revenue schedules</p>
          </div>
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner message="Loading..." />
          </div>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout tenantId={tenantId}>
      <div className="space-y-7 max-w-[1800px] mx-auto">
        {/* Search Bar */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search schedules by type, account code, account name, amount, or date..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6d69ff] focus:border-transparent text-sm"
              />
            </div>
          </div>
        </div>

        {/* Schedules Table */}
        {error ? (
          <ErrorMessage message={error} />
        ) : loading ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
              <h3 className="text-base font-bold text-gray-900">Schedules</h3>
              <p className="text-xs text-gray-500 mt-0.5">Search and view all prepayment and unearned revenue schedules</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="px-5 py-3"><div className="h-3 w-12 bg-gray-200 rounded animate-pulse"></div></th>
                    <th className="px-5 py-3"><div className="h-3 w-16 bg-gray-200 rounded animate-pulse"></div></th>
                    <th className="px-5 py-3"><div className="h-3 w-24 bg-gray-200 rounded animate-pulse"></div></th>
                    <th className="px-5 py-3"><div className="h-3 w-16 bg-gray-200 rounded animate-pulse"></div></th>
                    <th className="px-5 py-3"><div className="h-3 w-16 bg-gray-200 rounded animate-pulse"></div></th>
                    <th className="px-5 py-3"><div className="h-3 w-16 bg-gray-200 rounded animate-pulse"></div></th>
                    <th className="px-5 py-3"><div className="h-3 w-20 bg-gray-200 rounded animate-pulse"></div></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                    <tr key={i}>
                      <td className="px-5 py-3"><Skeleton className="h-5 w-20" variant="rectangular" /></td>
                      <td className="px-5 py-3"><Skeleton className="h-4 w-24" variant="text" /></td>
                      <td className="px-5 py-3">
                        <Skeleton className="h-4 w-20 mb-1" variant="text" />
                        <Skeleton className="h-3 w-32" variant="text" />
                      </td>
                      <td className="px-5 py-3">
                        <Skeleton className="h-4 w-24 mb-1" variant="text" />
                        <Skeleton className="h-3 w-32" variant="text" />
                      </td>
                      <td className="px-5 py-3">
                        <Skeleton className="h-4 w-32 mb-1" variant="text" />
                        <Skeleton className="h-3 w-24" variant="text" />
                      </td>
                      <td className="px-5 py-3"><Skeleton className="h-5 w-16" variant="rectangular" /></td>
                      <td className="px-5 py-3"><Skeleton className="h-4 w-24" variant="text" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md hover:border-gray-300">
            <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
              <h3 className="text-base font-bold text-gray-900">Schedules</h3>
              <p className="text-xs text-gray-500 mt-0.5">Search and view all prepayment and unearned revenue schedules</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Contact</th>
                    <th className="px-5 py-3">Account Code & Name</th>
                    <th className="px-5 py-3">Amount</th>
                    <th className="px-5 py-3">Period</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Created Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredSchedules.map((schedule) => {
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
                            {schedule.type === 'PREPAID' ? 'Prepayment' : 'Unearned Revenue'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm font-medium text-gray-900">{schedule.contactName || '—'}</td>
                        <td className="px-5 py-3">
                          <div className="text-sm text-gray-900">{schedule.type === 'PREPAID' ? schedule.expenseAcctCode : schedule.revenueAcctCode}</div>
                          {accountsLoaded && (
                            <div className="text-xs text-gray-500">
                              {getAccountName(schedule.type === 'PREPAID' ? schedule.expenseAcctCode : schedule.revenueAcctCode) || ''}
                            </div>
                          )}
                          {!accountsLoaded && (
                            <div className="text-xs text-gray-400 italic">Loading...</div>
                          )}
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
                          {schedule.totalPeriods !== undefined && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              {schedule.totalPeriods} {schedule.totalPeriods === 1 ? 'period' : 'periods'}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {(() => {
                            const isNotPosted = postedCount === 0 && totalCount > 0;
                            
                            if (isComplete) {
                              return (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-100 text-purple-700">
                                  {postedCount}/{totalCount} Posted
                                </span>
                              );
                            } else if (isNotPosted) {
                              return (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-gray-100 text-gray-700">
                                  {postedCount}/{totalCount} Posted
                                </span>
                              );
                            } else {
                              return (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-yellow-100 text-yellow-700">
                                  {postedCount}/{totalCount} Posted
                                </span>
                              );
                            }
                          })()}
                        </td>
                        <td className="px-5 py-3 text-sm text-gray-500">{formatDate(schedule.createdAt)}</td>
                      </tr>
                    );
                  })}
                  {filteredSchedules.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                        <div className="flex flex-col items-center gap-2">
                          <Calendar className="w-8 h-8 text-gray-300" />
                          <p>{searchQuery ? 'No schedules found matching your search.' : 'No schedules found.'}</p>
                          <p className="text-xs">{searchQuery ? 'Try adjusting your search query.' : 'Create your first schedule to see it here.'}</p>
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
            <div className="p-8 max-w-[1800px] mx-auto">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
                  <h3 className="text-base font-bold text-gray-900">Schedules</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Search and view all prepayment and unearned revenue schedules</p>
                </div>
                <div className="flex justify-center items-center py-12">
                  <LoadingSpinner message="Loading..." />
                </div>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <ScheduleRegisterContent />
    </Suspense>
  );
}

