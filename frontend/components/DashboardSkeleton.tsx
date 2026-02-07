import Skeleton from './Skeleton';
import ChartSkeleton from './ChartSkeleton';

const SUMMARY_TITLES = [
  'Prepayment Schedule',
  'Prepayment Balance',
  'Unearned Revenue Schedule',
  'Unearned Revenue Balance',
];

export default function DashboardSkeleton() {
  return (
    <div className="space-y-7 max-w-[1800px] mx-auto">
      {/* Summary Cards Skeleton - real titles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {SUMMARY_TITLES.map((title, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
              <h3 className="text-sm font-bold text-gray-900">{title}</h3>
            </div>
            <div className="p-5">
              <Skeleton className="h-8 w-24 mb-2" variant="text" />
              <Skeleton className="h-3 w-40" variant="text" />
            </div>
          </div>
        ))}
      </div>

      {/* Charts Skeleton - real titles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
            <h3 className="text-base font-bold text-gray-900">Prepayment Balance Projection</h3>
          </div>
          <div className="p-5">
            <div className="h-[270px] w-full">
              <ChartSkeleton />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
            <h3 className="text-base font-bold text-gray-900">Unearned Revenue Balance Projection</h3>
          </div>
          <div className="p-5">
            <div className="h-[270px] w-full">
              <ChartSkeleton />
            </div>
          </div>
        </div>
      </div>

      {/* Table Skeleton - real title */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-900">Recent Schedules</h3>
            <p className="text-xs text-gray-500 mt-0.5">Your 10 most recently created prepayment and unearned revenue schedules</p>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-7 w-20" variant="rectangular" />
            <Skeleton className="h-7 w-28" variant="rectangular" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-5 py-3">
                  <Skeleton className="h-3 w-12" variant="text" />
                </th>
                <th className="px-5 py-3">
                  <Skeleton className="h-3 w-16" variant="text" />
                </th>
                <th className="px-5 py-3">
                  <Skeleton className="h-3 w-24" variant="text" />
                </th>
                <th className="px-5 py-3">
                  <Skeleton className="h-3 w-16" variant="text" />
                </th>
                <th className="px-5 py-3">
                  <Skeleton className="h-3 w-16" variant="text" />
                </th>
                <th className="px-5 py-3">
                  <Skeleton className="h-3 w-16" variant="text" />
                </th>
                <th className="px-5 py-3">
                  <Skeleton className="h-3 w-20" variant="text" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                <tr key={i}>
                  <td className="px-5 py-3">
                    <Skeleton className="h-4 w-20" variant="text" />
                  </td>
                  <td className="px-5 py-3">
                    <Skeleton className="h-4 w-24" variant="text" />
                  </td>
                  <td className="px-5 py-3">
                    <Skeleton className="h-4 w-32" variant="text" />
                  </td>
                  <td className="px-5 py-3">
                    <Skeleton className="h-4 w-20" variant="text" />
                  </td>
                  <td className="px-5 py-3">
                    <Skeleton className="h-4 w-32" variant="text" />
                  </td>
                  <td className="px-5 py-3">
                    <Skeleton className="h-4 w-20" variant="text" />
                  </td>
                  <td className="px-5 py-3">
                    <Skeleton className="h-4 w-24" variant="text" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

