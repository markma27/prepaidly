import Skeleton from './Skeleton';

interface TableSkeletonProps {
  columns?: number;
  rows?: number;
  showHeader?: boolean;
  showActions?: boolean;
}

export default function TableSkeleton({ 
  columns = 6, 
  rows = 10, 
  showHeader = true,
  showActions = false 
}: TableSkeletonProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {showHeader && (
        <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
          <Skeleton className="h-5 w-40 mb-1" variant="text" />
          <Skeleton className="h-3 w-64" variant="text" />
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50">
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i} className="px-5 py-3">
                  <Skeleton className="h-3 w-16" variant="text" />
                </th>
              ))}
              {showActions && (
                <th className="px-5 py-3">
                  <Skeleton className="h-3 w-12" variant="text" />
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: columns }).map((_, j) => (
                  <td key={j} className="px-5 py-3">
                    <Skeleton className="h-4 w-24" variant="text" />
                  </td>
                ))}
                {showActions && (
                  <td className="px-5 py-3">
                    <Skeleton className="h-4 w-16" variant="text" />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

