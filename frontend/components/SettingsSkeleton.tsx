import Skeleton from './Skeleton';

export default function SettingsSkeleton() {
  return (
    <div className="max-w-[1800px] mx-auto p-6 space-y-6">
      {/* Connection Status Skeleton */}
      <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center mb-2">
              <Skeleton className="h-3 w-3 rounded-full" variant="circular" />
              <Skeleton className="h-6 w-48 ml-3" variant="text" />
            </div>
            <Skeleton className="h-4 w-32" variant="text" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32" variant="rectangular" />
            <Skeleton className="h-9 w-20" variant="rectangular" />
          </div>
        </div>
      </div>

      {/* Default Accounts Skeleton */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
          <div className="flex justify-between items-center">
            <div className="flex-1">
              <Skeleton className="h-4 w-32 mb-1" variant="text" />
              <Skeleton className="h-3 w-48" variant="text" />
            </div>
            <Skeleton className="h-8 w-20" variant="rectangular" />
          </div>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Prepayment Account Skeleton */}
            <div>
              <Skeleton className="h-4 w-48 mb-2" variant="text" />
              <Skeleton className="h-10 w-full rounded-lg" variant="rectangular" />
              <Skeleton className="h-3 w-56 mt-1" variant="text" />
            </div>
            {/* Unearned Account Skeleton */}
            <div>
              <Skeleton className="h-4 w-56 mb-2" variant="text" />
              <Skeleton className="h-10 w-full rounded-lg" variant="rectangular" />
              <Skeleton className="h-3 w-56 mt-1" variant="text" />
            </div>
          </div>
        </div>
      </div>

      {/* Chart of Accounts Skeleton */}
      <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10">
          <div className="flex justify-between items-center">
            <Skeleton className="h-6 w-40" variant="text" />
            <Skeleton className="h-4 w-24" variant="text" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <Skeleton className="h-3 w-24" variant="text" />
                </th>
                <th className="px-6 py-3 text-left">
                  <Skeleton className="h-3 w-24" variant="text" />
                </th>
                <th className="px-6 py-3 text-left">
                  <Skeleton className="h-3 w-16" variant="text" />
                </th>
                <th className="px-6 py-3 text-left">
                  <Skeleton className="h-3 w-16" variant="text" />
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                <tr key={i}>
                  <td className="px-6 py-4">
                    <Skeleton className="h-4 w-16" variant="text" />
                  </td>
                  <td className="px-6 py-4">
                    <Skeleton className="h-4 w-32" variant="text" />
                  </td>
                  <td className="px-6 py-4">
                    <Skeleton className="h-4 w-24" variant="text" />
                  </td>
                  <td className="px-6 py-4">
                    <Skeleton className="h-5 w-16 rounded-full" variant="rectangular" />
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
