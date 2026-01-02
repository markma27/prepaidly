'use client';

import { Suspense, useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { scheduleApi } from '@/lib/api';
import { formatDate, formatCurrency } from '@/lib/utils';
import type { Schedule } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import DashboardLayout from '@/components/DashboardLayout';
import DashboardSkeleton from '@/components/DashboardSkeleton';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  Calendar, 
  DollarSign, 
  Plus,
  ArrowRight,
  MoreHorizontal
} from 'lucide-react';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg">
        <p className="text-sm font-semibold text-gray-600 mb-1">{label}</p>
        <p className="text-sm font-bold text-gray-900">{formatCurrency(payload[0].value)}</p>
      </div>
    );
  }
  return null;
};

function DashboardPageContent() {
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

  const stats = useMemo(() => {
    const totalSchedules = schedules.length;
    const totalAmount = schedules.reduce((acc, s) => acc + s.totalAmount, 0);
    const prepaidSchedules = schedules.filter(s => s.type === 'PREPAID');
    const unearnedSchedules = schedules.filter(s => s.type === 'UNEARNED');
    
    const prepaidBalance = prepaidSchedules.reduce((acc, s) => acc + (s.remainingBalance || 0), 0);
    const unearnedBalance = unearnedSchedules.reduce((acc, s) => acc + (s.remainingBalance || 0), 0);

    return {
      totalSchedules,
      totalAmount,
      prepaidBalance,
      unearnedBalance,
      prepaidCount: prepaidSchedules.length,
      unearnedCount: unearnedSchedules.length
    };
  }, [schedules]);

  const chartData = useMemo(() => {
    const getProjectedData = (type: 'PREPAID' | 'UNEARNED') => {
      const data = [];
      const today = new Date();
      
      for (let i = 0; i < 12; i++) {
        const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const monthStr = date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
        
        let totalRemaining = 0;
        schedules.filter(s => s.type === type).forEach(s => {
          const remainingAtDate = s.journalEntries
            ?.filter(je => new Date(je.periodDate) > date)
            .reduce((acc, je) => acc + je.amount, 0) || 0;
          totalRemaining += remainingAtDate;
        });
        
        data.push({
          name: monthStr,
          value: totalRemaining
        });
      }
      return data;
    };

    return {
      prepaid: getProjectedData('PREPAID'),
      unearned: getProjectedData('UNEARNED')
    };
  }, [schedules]);

  if (loading && !tenantId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner message="Loading..." />
      </div>
    );
  }

  return (
    <DashboardLayout tenantId={tenantId}>
      {loading ? (
        <DashboardSkeleton />
      ) : (
      <div className="space-y-8 max-w-[1600px] mx-auto">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-500">Total Schedules</span>
              <span className="px-2 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-md flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                Active
              </span>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-2">{stats.totalSchedules}</div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Calendar className="w-3.5 h-3.5" />
              <span>Total created schedules</span>
            </div>
            <div className="mt-1 text-xs text-gray-400">Across all time periods</div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-500">Total Amount Managed</span>
              <span className="text-xs font-semibold text-gray-400">$ AUD</span>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-2">{formatCurrency(stats.totalAmount)}</div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <DollarSign className="w-3.5 h-3.5" />
              <span>Combined prepaid & unearned $</span>
            </div>
            <div className="mt-1 text-xs text-gray-400">Total value under management</div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-500">Prepaid Expenses</span>
              <span className="px-2 py-1 bg-gray-50 text-gray-600 text-xs font-semibold rounded-md flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {stats.prepaidCount} schedules
              </span>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-2">{formatCurrency(stats.prepaidBalance)}</div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <span>Prepaid expense schedules</span>
              <ArrowRight className="w-3 h-3" />
            </div>
            <div className="mt-1 text-xs text-gray-400">{stats.prepaidCount} active schedules</div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-500">Unearned Revenue</span>
              <span className="px-2 py-1 bg-gray-50 text-gray-600 text-xs font-semibold rounded-md flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {stats.unearnedCount} schedules
              </span>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-2">{formatCurrency(stats.unearnedBalance)}</div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <span>Unearned revenue schedules</span>
              <ArrowRight className="w-3 h-3" />
            </div>
            <div className="mt-1 text-xs text-gray-400">{stats.unearnedCount} active schedules</div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900">Prepaid Expenses - Next 12 Months</h3>
              <p className="text-sm text-gray-500">Remaining prepaid expense balances by month</p>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.prepaid}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#9CA3AF' }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#9CA3AF' }}
                    tickFormatter={(value) => `$${value/1000}K`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={32}>
                    {chartData.prepaid.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={`rgba(59, 130, 246, ${1 - index * 0.06})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900">Unearned Revenue - Next 12 Months</h3>
              <p className="text-sm text-gray-500">Remaining unearned revenue balances by month</p>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.unearned}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#9CA3AF' }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#9CA3AF' }}
                    tickFormatter={(value) => `$${value/1000}K`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={32}>
                    {chartData.unearned.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={`rgba(16, 185, 129, ${1 - index * 0.06})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Recent Schedules Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 flex items-center justify-between border-b border-gray-100">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Recent Schedules</h3>
              <p className="text-sm text-gray-500">Your 7 most recently created prepayment and unearned revenue schedules</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => router.push(`/app/dashboard?tenantId=${tenantId}`)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                View All
              </button>
              <button 
                onClick={() => router.push(`/app/schedules/new?tenantId=${tenantId}`)}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                New Schedule
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4">Account Code & Name</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Period</th>
                  <th className="px-6 py-4">Description</th>
                  <th className="px-6 py-4">Created Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {schedules.slice(0, 7).map((schedule) => (
                  <tr key={schedule.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => router.push(`/app/dashboard?tenantId=${tenantId}`)}>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${
                        schedule.type === 'PREPAID' 
                          ? 'bg-blue-50 text-blue-600' 
                          : 'bg-green-50 text-green-600'
                      }`}>
                        {schedule.type === 'PREPAID' ? 'Prepaid Expense' : 'Unearned Revenue'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">BCD Trust</td> {/* Placeholder as contact info isn't in Schedule type yet */}
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{schedule.type === 'PREPAID' ? schedule.expenseAcctCode : schedule.revenueAcctCode}</div>
                      <div className="text-xs text-gray-500">{schedule.type === 'PREPAID' ? 'Prepaid Subscriptions' : 'Sales'}</div>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">{formatCurrency(schedule.totalAmount)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatDate(schedule.startDate)} - {formatDate(schedule.endDate)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">Service Income</td> {/* Placeholder */}
                    <td className="px-6 py-4 text-sm text-gray-500">{formatDate(schedule.createdAt)}</td>
                  </tr>
                ))}
                {schedules.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      No schedules found. Create your first one to see it here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      )}
    </DashboardLayout>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white">
        <div className="fixed inset-y-0 left-0 w-56 bg-[#F9FAFB] z-10 border-r border-gray-200"></div>
        <div className="pl-56">
          <div className="p-8">
            <DashboardSkeleton />
          </div>
        </div>
      </div>
    }>
      <DashboardPageContent />
    </Suspense>
  );
}

