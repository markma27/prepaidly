import Skeleton from './Skeleton';

export default function ScheduleDetailSkeleton() {
  return (
    <div className="space-y-7 max-w-[1800px] mx-auto">
      {/* Back Button Skeleton */}
      <Skeleton className="h-5 w-48" variant="text" />

      {/* Schedule Summary Card Skeleton */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
          <Skeleton className="h-5 w-40" variant="text" />
        </div>
        <div className="p-5">
          {/* First row: Type, Total Amount, Period, Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Type */}
            <div>
              <Skeleton className="h-3 w-12 mb-1" variant="text" />
              <Skeleton className="h-5 w-24 rounded-md" variant="rectangular" />
            </div>
            {/* Total Amount */}
            <div>
              <Skeleton className="h-3 w-24 mb-1" variant="text" />
              <Skeleton className="h-5 w-28" variant="text" />
              <Skeleton className="h-3 w-32 mt-0.5" variant="text" />
            </div>
            {/* Period */}
            <div>
              <Skeleton className="h-3 w-16 mb-1" variant="text" />
              <Skeleton className="h-4 w-48" variant="text" />
              <Skeleton className="h-3 w-20 mt-0.5" variant="text" />
            </div>
            {/* Status */}
            <div>
              <Skeleton className="h-3 w-16 mb-1" variant="text" />
              <Skeleton className="h-5 w-32 rounded-md" variant="rectangular" />
            </div>
          </div>

          {/* Divider and second section */}
          <div className="mt-5 pt-5 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              {/* Contact */}
              <div>
                <Skeleton className="h-3 w-16 mb-1" variant="text" />
                <Skeleton className="h-4 w-32" variant="text" />
              </div>
              {/* Expense/Revenue Account */}
              <div>
                <Skeleton className="h-3 w-32 mb-1" variant="text" />
                <Skeleton className="h-4 w-36" variant="text" />
              </div>
              {/* Invoice date */}
              <div>
                <Skeleton className="h-3 w-24 mb-1" variant="text" />
                <Skeleton className="h-4 w-28" variant="text" />
              </div>
              {/* Created */}
              <div>
                <Skeleton className="h-3 w-16 mb-1" variant="text" />
                <Skeleton className="h-4 w-28" variant="text" />
              </div>
              {/* Description - full width */}
              <div className="md:col-span-4">
                <Skeleton className="h-3 w-24 mb-1" variant="text" />
                <Skeleton className="h-4 w-64" variant="text" />
              </div>
            </div>
            {/* Invoice link */}
            <div className="mt-5">
              <Skeleton className="h-3 w-16 mb-1" variant="text" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded" variant="rectangular" />
                <Skeleton className="h-4 w-40" variant="text" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Journal Entries Table Skeleton */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
          <Skeleton className="h-5 w-32 mb-1" variant="text" />
          <Skeleton className="h-3 w-24" variant="text" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-5 py-3"><Skeleton className="h-3 w-24" variant="text" /></th>
                <th className="px-5 py-3"><Skeleton className="h-3 w-16" variant="text" /></th>
                <th className="px-5 py-3"><Skeleton className="h-3 w-16" variant="text" /></th>
                <th className="px-5 py-3"><Skeleton className="h-3 w-28" variant="text" /></th>
                <th className="px-5 py-3"><Skeleton className="h-3 w-16" variant="text" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                <tr key={i}>
                  <td className="px-5 py-3">
                    <Skeleton className="h-4 w-28" variant="text" />
                  </td>
                  <td className="px-5 py-3">
                    <Skeleton className="h-4 w-20" variant="text" />
                  </td>
                  <td className="px-5 py-3">
                    <Skeleton className="h-5 w-16 rounded-md" variant="rectangular" />
                  </td>
                  <td className="px-5 py-3">
                    <Skeleton className="h-4 w-8" variant="text" />
                  </td>
                  <td className="px-5 py-3">
                    <Skeleton className="h-7 w-24 rounded-lg" variant="rectangular" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Trail Skeleton */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
          <Skeleton className="h-4 w-24" variant="text" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-5 py-2"><Skeleton className="h-3 w-24" variant="text" /></th>
                <th className="px-5 py-2"><Skeleton className="h-3 w-16" variant="text" /></th>
                <th className="px-5 py-2"><Skeleton className="h-3 w-24" variant="text" /></th>
                <th className="px-5 py-2"><Skeleton className="h-3 w-16" variant="text" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[1, 2].map((i) => (
                <tr key={i}>
                  <td className="px-5 py-2">
                    <Skeleton className="h-3 w-48" variant="text" />
                  </td>
                  <td className="px-5 py-2">
                    <Skeleton className="h-3 w-28" variant="text" />
                  </td>
                  <td className="px-5 py-2">
                    <Skeleton className="h-3 w-56" variant="text" />
                  </td>
                  <td className="px-5 py-2">
                    <Skeleton className="h-3 w-64" variant="text" />
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
