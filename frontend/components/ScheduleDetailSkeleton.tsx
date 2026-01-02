import Skeleton from './Skeleton';

export default function ScheduleDetailSkeleton() {
  return (
    <div className="space-y-7 max-w-[1440px] mx-auto">
      {/* Back Button Skeleton */}
      <Skeleton className="h-5 w-48" variant="text" />

      {/* Schedule Summary Card Skeleton */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
          <Skeleton className="h-5 w-40" variant="text" />
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i}>
                <Skeleton className="h-3 w-20 mb-2" variant="text" />
                <Skeleton className="h-5 w-32" variant="text" />
              </div>
            ))}
          </div>
          <div className="pt-5 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <Skeleton className="h-3 w-24 mb-2" variant="text" />
                <Skeleton className="h-4 w-32" variant="text" />
                <Skeleton className="h-4 w-32 mt-1" variant="text" />
              </div>
              <div>
                <Skeleton className="h-3 w-20 mb-2" variant="text" />
                <Skeleton className="h-4 w-32" variant="text" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Journal Entries Table Skeleton */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
          <Skeleton className="h-5 w-40 mb-1" variant="text" />
          <Skeleton className="h-3 w-48" variant="text" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50">
                {['Period Date', 'Amount', 'Status', 'Xero Journal ID', 'Action'].map((_, i) => (
                  <th key={i} className="px-5 py-3">
                    <Skeleton className="h-3 w-20" variant="text" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                <tr key={i}>
                  <td className="px-5 py-3">
                    <Skeleton className="h-4 w-24" variant="text" />
                  </td>
                  <td className="px-5 py-3">
                    <Skeleton className="h-4 w-20" variant="text" />
                  </td>
                  <td className="px-5 py-3">
                    <Skeleton className="h-5 w-16" variant="rectangular" />
                  </td>
                  <td className="px-5 py-3">
                    <Skeleton className="h-4 w-32" variant="text" />
                  </td>
                  <td className="px-5 py-3">
                    <Skeleton className="h-7 w-24" variant="rectangular" />
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

