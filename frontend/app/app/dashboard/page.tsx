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

  // Remove black border on bar chart click
  useEffect(() => {
    const removeBlackStroke = () => {
      // Remove stroke from bar rectangles (only black, preserve blue and green)
      const barRectangles = document.querySelectorAll('.recharts-bar-rectangle');
      barRectangles.forEach((rect) => {
        const svgRect = rect as SVGElement;
        const stroke = svgRect.getAttribute('stroke');
        // Only remove black stroke, preserve blue (#3b82f6) and green (#22c55e)
        if (stroke === 'black' || stroke === '#000' || stroke === '#000000' || 
            stroke === 'rgb(0, 0, 0)' || (stroke && stroke.includes('000') && 
            stroke !== '#3b82f6' && stroke !== '#22c55e' && 
            stroke !== 'rgb(59, 130, 246)' && stroke !== 'rgb(34, 197, 94)')) {
          svgRect.setAttribute('stroke', 'none');
          svgRect.style.stroke = 'none';
        }
      });

      // Remove outline and border from SVG elements (entire chart)
      const svgElements = document.querySelectorAll('.recharts-wrapper svg');
      svgElements.forEach((svg) => {
        const svgEl = svg as SVGElement;
        svgEl.style.outline = 'none';
        svgEl.style.border = 'none';
        svgEl.setAttribute('style', svgEl.getAttribute('style')?.replace(/outline[^;]*;?/g, '') || '');
        svgEl.setAttribute('style', svgEl.getAttribute('style')?.replace(/border[^;]*;?/g, '') || '');
      });

      // Remove focus from wrapper elements
      const wrappers = document.querySelectorAll('.recharts-wrapper');
      wrappers.forEach((wrapper) => {
        const wrapperEl = wrapper as HTMLElement;
        wrapperEl.style.outline = 'none';
        wrapperEl.style.border = 'none';
        wrapperEl.setAttribute('tabindex', '-1');
      });

      // Remove focus from responsive containers
      const containers = document.querySelectorAll('.recharts-responsive-container');
      containers.forEach((container) => {
        const containerEl = container as HTMLElement;
        containerEl.style.outline = 'none';
        containerEl.style.border = 'none';
        containerEl.setAttribute('tabindex', '-1');
      });

      // Blur any focused chart elements
      const focusedElement = document.activeElement;
      if (focusedElement && (
        focusedElement.classList.contains('recharts-wrapper') ||
        focusedElement.classList.contains('recharts-responsive-container') ||
        focusedElement.tagName === 'svg' ||
        focusedElement.closest('.recharts-wrapper')
      )) {
        (focusedElement as HTMLElement).blur();
      }
    };

    // Remove black stroke immediately
    removeBlackStroke();
    
    // Use requestAnimationFrame for immediate removal
    const rafId = requestAnimationFrame(() => {
      removeBlackStroke();
    });

    // Remove on any click with immediate execution
    const handleClick = (e: MouseEvent) => {
      removeBlackStroke();
      // Use setTimeout to catch any delayed changes
      setTimeout(removeBlackStroke, 0);
      setTimeout(removeBlackStroke, 10);
      setTimeout(removeBlackStroke, 50);
    };
    
    document.addEventListener('click', handleClick, true); // Use capture phase
    
    // Use MutationObserver with more aggressive watching
    const observer = new MutationObserver(() => {
      removeBlackStroke();
    });
    
    const chartContainers = document.querySelectorAll('.recharts-wrapper');
    chartContainers.forEach((container) => {
      observer.observe(container, { 
        attributes: true, 
        subtree: true, 
        attributeFilter: ['stroke', 'style', 'tabindex'],
        childList: true,
        characterData: false
      });
    });

    // Also check periodically
    const intervalId = setInterval(removeBlackStroke, 100);

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('click', handleClick, true);
      observer.disconnect();
      clearInterval(intervalId);
    };
  }, [schedules]);

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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Current month date (first day of current month) - same as chart calculation
    const currentMonthDate = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const prepaidSchedules = schedules.filter(s => s.type === 'PREPAID');
    const unearnedSchedules = schedules.filter(s => s.type === 'UNEARNED');
    
    // Active schedules: startDate <= today <= endDate
    const activePrepaidSchedules = prepaidSchedules.filter(s => {
      const start = new Date(s.startDate);
      const end = new Date(s.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return start <= today && today <= end;
    });
    
    const activeUnearnedSchedules = unearnedSchedules.filter(s => {
      const start = new Date(s.startDate);
      const end = new Date(s.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return start <= today && today <= end;
    });
    
    // Remaining amounts for current month - same calculation as chart
    // Sum of journal entries with periodDate > currentMonthDate
    const remainingPrepaid = prepaidSchedules.reduce((acc, s) => {
      if (s.journalEntries && Array.isArray(s.journalEntries) && s.journalEntries.length > 0) {
        const remainingAtDate = s.journalEntries
          .filter(je => new Date(je.periodDate) > currentMonthDate)
          .reduce((sum, je) => sum + (je.amount || 0), 0);
        return acc + remainingAtDate;
      }
      return acc;
    }, 0);
    
    const remainingUnearned = unearnedSchedules.reduce((acc, s) => {
      if (s.journalEntries && Array.isArray(s.journalEntries) && s.journalEntries.length > 0) {
        const remainingAtDate = s.journalEntries
          .filter(je => new Date(je.periodDate) > currentMonthDate)
          .reduce((sum, je) => sum + (je.amount || 0), 0);
        return acc + remainingAtDate;
      }
      return acc;
    }, 0);

    return {
      prepaidScheduleCount: activePrepaidSchedules.length,
      remainingPrepayment: remainingPrepaid,
      unearnedScheduleCount: activeUnearnedSchedules.length,
      remainingUnearned: remainingUnearned
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
      <div className="space-y-7 max-w-[1440px] mx-auto">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Prepayment Schedule */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md hover:border-gray-300 cursor-pointer">
            <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
              <h3 className="text-sm font-bold text-gray-900">Prepayment Schedule</h3>
            </div>
            <div className="p-5">
              <div className="text-2xl font-bold text-gray-900 mb-2">{stats.prepaidScheduleCount}</div>
              <div className="text-xs text-gray-500">Active prepayment schedules</div>
            </div>
          </div>

          {/* Remaining Prepayment */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md hover:border-gray-300 cursor-pointer">
            <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
              <h3 className="text-sm font-bold text-gray-900">Remaining Prepayment</h3>
            </div>
            <div className="p-5">
              <div className="text-2xl font-bold text-gray-900 mb-2">{formatCurrency(stats.remainingPrepayment)}</div>
              <div className="text-xs text-gray-500">Amount not yet processed</div>
            </div>
          </div>

          {/* Unearned Revenue Schedule */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md hover:border-gray-300 cursor-pointer">
            <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
              <h3 className="text-sm font-bold text-gray-900">Unearned Revenue Schedule</h3>
            </div>
            <div className="p-5">
              <div className="text-2xl font-bold text-gray-900 mb-2">{stats.unearnedScheduleCount}</div>
              <div className="text-xs text-gray-500">Active unearned revenue schedules</div>
            </div>
          </div>

          {/* Remaining Unearned Revenue */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md hover:border-gray-300 cursor-pointer">
            <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
              <h3 className="text-sm font-bold text-gray-900">Remaining Unearned Revenue</h3>
            </div>
            <div className="p-5">
              <div className="text-2xl font-bold text-gray-900 mb-2">{formatCurrency(stats.remainingUnearned)}</div>
              <div className="text-xs text-gray-500">Amount not yet processed</div>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md hover:border-gray-300">
            <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
              <h3 className="text-base font-bold text-gray-900">Prepayment - Next 12 Months</h3>
            </div>
            <div className="p-5">
              <div className="h-[270px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={chartData.prepaid}
                    style={{ outline: 'none' }}
                    tabIndex={-1}
                  >
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
                    <Bar 
                      dataKey="value" 
                      radius={[4, 4, 0, 0]} 
                      barSize={32}
                      isAnimationActive={false}
                      onClick={() => {}}
                      style={{ outline: 'none' }}
                      stroke="#3b82f6"
                      strokeWidth={1}
                    >
                      {chartData.prepaid.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={`rgba(59, 130, 246, 0.1)`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md hover:border-gray-300">
            <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
              <h3 className="text-base font-bold text-gray-900">Unearned Revenue - Next 12 Months</h3>
            </div>
            <div className="p-5">
              <div className="h-[270px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={chartData.unearned}
                    style={{ outline: 'none' }}
                    tabIndex={-1}
                  >
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
                    <Bar 
                      dataKey="value" 
                      radius={[4, 4, 0, 0]} 
                      barSize={32}
                      isAnimationActive={false}
                      onClick={() => {}}
                      style={{ outline: 'none' }}
                      stroke="#22c55e"
                      strokeWidth={1}
                    >
                      {chartData.unearned.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={`rgba(74, 222, 128, 0.1)`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Schedules Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md hover:border-gray-300">
          <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900">Recent Schedules</h3>
              <p className="text-xs text-gray-500 mt-0.5">Your 10 most recently created prepayment and unearned revenue schedules</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => router.push(`/app/dashboard?tenantId=${tenantId}`)}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                View All
              </button>
              <button 
                onClick={() => router.push(`/app/schedules/new?tenantId=${tenantId}`)}
                className="px-3 py-1.5 text-xs font-medium text-white bg-[#6d69ff] rounded-lg hover:bg-[#5a56e6] transition-colors flex items-center gap-2"
              >
                <Plus className="w-3.5 h-3.5" />
                New Schedule
              </button>
            </div>
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
                  <th className="px-5 py-3">Created Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {schedules.slice(0, 10).map((schedule) => (
                  <tr key={schedule.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => router.push(`/app/dashboard?tenantId=${tenantId}`)}>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                        schedule.type === 'PREPAID' 
                          ? 'bg-blue-50 text-blue-600' 
                          : 'bg-green-50 text-green-600'
                      }`}>
                        {schedule.type === 'PREPAID' ? 'Prepaid Expense' : 'Unearned Revenue'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm font-medium text-gray-900">BCD Trust</td> {/* Placeholder as contact info isn't in Schedule type yet */}
                    <td className="px-5 py-3">
                      <div className="text-sm text-gray-900">{schedule.type === 'PREPAID' ? schedule.expenseAcctCode : schedule.revenueAcctCode}</div>
                      <div className="text-xs text-gray-500">{schedule.type === 'PREPAID' ? 'Prepaid Subscriptions' : 'Sales'}</div>
                    </td>
                    <td className="px-5 py-3 text-sm font-bold text-gray-900">{formatCurrency(schedule.totalAmount)}</td>
                    <td className="px-5 py-3 text-sm text-gray-600">
                      {formatDate(schedule.startDate)} - {formatDate(schedule.endDate)}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500">{formatDate(schedule.createdAt)}</td>
                  </tr>
                ))}
                {schedules.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
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

