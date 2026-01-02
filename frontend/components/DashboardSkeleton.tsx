import Skeleton from './Skeleton';

export default function DashboardSkeleton() {
  return (
    <div className="space-y-7 max-w-[1440px] mx-auto">
      {/* Summary Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
              <Skeleton className="h-4 w-32" variant="text" />
            </div>
            <div className="p-5">
              <Skeleton className="h-8 w-24 mb-2" variant="text" />
              <Skeleton className="h-3 w-40" variant="text" />
            </div>
          </div>
        ))}
      </div>

      {/* Charts Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-7">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
              <Skeleton className="h-5 w-56" variant="text" />
            </div>
            <div className="p-5">
              <Skeleton className="h-[270px] w-full" variant="rectangular" />
            </div>
          </div>
        ))}
      </div>

      {/* Table Skeleton */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3 flex items-center justify-between">
          <div>
            <Skeleton className="h-5 w-40 mb-1" variant="text" />
            <Skeleton className="h-3 w-64" variant="text" />
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

