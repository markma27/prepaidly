import Skeleton from './Skeleton';

export default function UsersSkeleton() {
  return (
    <div className="max-w-[1800px] mx-auto p-6">
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Users with access</h2>
              <p className="text-sm text-gray-500 mt-0.5">People who can access this entity</p>
            </div>
            <div className="h-9 w-28 rounded-lg overflow-hidden">
              <Skeleton className="h-full w-full rounded-lg" variant="rectangular" />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Display name
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last login
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i}>
                  <td className="px-6 py-3.5 whitespace-nowrap">
                    <div className="h-5 w-32 rounded overflow-hidden">
                      <Skeleton className="h-full w-full" variant="rectangular" />
                    </div>
                  </td>
                  <td className="px-6 py-3.5 whitespace-nowrap">
                    <div className="h-5 w-48 rounded overflow-hidden">
                      <Skeleton className="h-full w-full" variant="rectangular" />
                    </div>
                  </td>
                  <td className="px-6 py-3.5 whitespace-nowrap">
                    <div className="h-5 w-20 rounded overflow-hidden">
                      <Skeleton className="h-full w-full" variant="rectangular" />
                    </div>
                  </td>
                  <td className="px-6 py-3.5 whitespace-nowrap">
                    <div className="h-5 w-28 rounded overflow-hidden">
                      <Skeleton className="h-full w-full" variant="rectangular" />
                    </div>
                  </td>
                  <td className="px-6 py-3.5 whitespace-nowrap">
                    <div className="h-5 w-24 rounded overflow-hidden">
                      <Skeleton className="h-full w-full" variant="rectangular" />
                    </div>
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
