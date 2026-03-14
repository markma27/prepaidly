import Skeleton from './Skeleton';

export default function UsersSkeleton() {
  return (
    <div className="space-y-7 max-w-[1800px] mx-auto">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-900">Users with access</h3>
            <p className="text-xs text-gray-500 mt-0.5">People who can access this entity</p>
          </div>
          <div className="h-8 w-24 rounded-lg overflow-hidden">
            <Skeleton className="h-full w-full rounded-lg" variant="rectangular" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-5 py-3">Display name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3">Last login</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i}>
                  <td className="px-5 py-3">
                    <Skeleton className="h-5 w-28" variant="rectangular" />
                  </td>
                  <td className="px-5 py-3">
                    <Skeleton className="h-5 w-44" variant="rectangular" />
                  </td>
                  <td className="px-5 py-3">
                    <Skeleton className="h-5 w-20" variant="rectangular" />
                  </td>
                  <td className="px-5 py-3">
                    <Skeleton className="h-5 w-24" variant="rectangular" />
                  </td>
                  <td className="px-5 py-3">
                    <Skeleton className="h-5 w-28" variant="rectangular" />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Skeleton className="h-7 w-24 ml-auto" variant="rectangular" />
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
