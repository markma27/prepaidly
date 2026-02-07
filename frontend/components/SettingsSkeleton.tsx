import Skeleton from './Skeleton';

export default function SettingsSkeleton() {
  return (
    <div className="max-w-[1800px] mx-auto p-6">
      {/* Connection Status - same card structure and heights as loaded */}
      <div className="bg-white shadow-sm rounded-lg p-6 mb-6 border border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center mb-2">
              <Skeleton className="h-3 w-3 rounded-full flex-shrink-0" variant="circular" />
              <Skeleton className="h-6 w-56 ml-3" variant="text" />
            </div>
            <Skeleton className="h-5 w-72 max-w-full" variant="text" />
          </div>
          <div className="flex gap-2 flex-shrink-0 ml-4">
            <Skeleton className="h-9 w-24 rounded" variant="rectangular" />
            <Skeleton className="h-9 w-20 rounded" variant="rectangular" />
          </div>
        </div>
      </div>

      {/* Default Accounts - real titles, same layout as loaded */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
        <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-4">
          <div className="flex justify-between items-start gap-4">
            <div className="min-w-0">
              <h3 className="text-base font-bold text-gray-900">Default Accounts</h3>
              <p className="text-xs text-gray-500 mt-1">Set default accounts for new schedules</p>
            </div>
            <Skeleton className="h-9 w-14 rounded-lg flex-shrink-0" variant="rectangular" />
          </div>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="min-w-0">
              <Skeleton className="h-5 w-full mb-2" variant="text" />
              <Skeleton className="h-[2.75rem] w-full rounded-lg" variant="rectangular" />
              <Skeleton className="h-3 w-full mt-1.5" variant="text" />
            </div>
            <div className="min-w-0">
              <Skeleton className="h-5 w-full mb-2" variant="text" />
              <Skeleton className="h-[2.75rem] w-full rounded-lg" variant="rectangular" />
              <Skeleton className="h-3 w-full mt-1.5" variant="text" />
            </div>
          </div>
        </div>
      </div>

      {/* Chart of Accounts - real title, same table structure as loaded */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">Chart of Accounts</h2>
            <Skeleton className="h-4 w-20" variant="text" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Account Code
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Account Name
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
                <tr key={i}>
                  <td className="px-6 py-3.5 whitespace-nowrap text-left align-middle">
                    <Skeleton className="h-5 w-12" variant="text" />
                  </td>
                  <td className="px-6 py-3.5 text-left align-middle">
                    <Skeleton className="h-5 w-40" variant="text" />
                  </td>
                  <td className="px-6 py-3.5 whitespace-nowrap text-left align-middle">
                    <Skeleton className="h-5 w-24" variant="text" />
                  </td>
                  <td className="px-6 py-3.5 whitespace-nowrap text-left align-middle">
                    <Skeleton className="h-5 w-[4.5rem] rounded-full" variant="rectangular" />
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
