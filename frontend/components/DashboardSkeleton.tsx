import Skeleton from './Skeleton';

export default function DashboardSkeleton() {
  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
      {/* Summary Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <Skeleton className="h-4 w-24 mb-4" variant="text" />
            <Skeleton className="h-8 w-32 mb-2" variant="text" />
            <Skeleton className="h-3 w-40 mb-1" variant="text" />
            <Skeleton className="h-3 w-32" variant="text" />
          </div>
        ))}
      </div>

      {/* Charts Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <Skeleton className="h-6 w-48 mb-2" variant="text" />
            <Skeleton className="h-4 w-64 mb-6" variant="text" />
            <Skeleton className="h-[300px] w-full" variant="rectangular" />
          </div>
        ))}
      </div>

      {/* Table Skeleton */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 flex items-center justify-between border-b border-gray-100">
          <div className="flex-1">
            <Skeleton className="h-6 w-40 mb-2" variant="text" />
            <Skeleton className="h-4 w-64" variant="text" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-9 w-24" variant="rectangular" />
            <Skeleton className="h-9 w-32" variant="rectangular" />
          </div>
        </div>
        <div className="p-6">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-24" variant="text" />
                <Skeleton className="h-4 w-32" variant="text" />
                <Skeleton className="h-4 w-40" variant="text" />
                <Skeleton className="h-4 w-24" variant="text" />
                <Skeleton className="h-4 w-32" variant="text" />
                <Skeleton className="h-4 w-28" variant="text" />
                <Skeleton className="h-4 w-24" variant="text" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

