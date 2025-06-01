import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 animate-in fade-in duration-500">
      {/* Loading Message */}
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-lg font-medium">Switching organisation...</span>
          </div>
        </div>
      </div>

      {/* Header Skeleton */}
      <div className="px-4 sm:px-6 lg:px-8 opacity-50">
        <div className="mb-6">
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
      </div>

      {/* Cards Skeleton */}
      <div className="px-4 sm:px-6 lg:px-8 opacity-50">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4 rounded" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-7 w-20 mb-1" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      
      {/* Chart Skeleton */}
      <div className="px-4 sm:px-6 lg:px-8 opacity-50">
        <Card className="animate-pulse">
          <CardHeader>
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="pl-2">
            <Skeleton className="h-80 w-full" />
          </CardContent>
        </Card>
      </div>
      
      {/* Table Skeleton */}
      <div className="px-4 sm:px-6 lg:px-8 opacity-50">
        <Card className="animate-pulse">
          <CardHeader>
            <Skeleton className="h-6 w-40 mb-2" />
            <Skeleton className="h-4 w-80" />
          </CardHeader>
          <CardContent>
            {/* Table header */}
            <div className="grid grid-cols-6 gap-4 pb-2 mb-4 border-b">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
            {/* Table rows */}
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="grid grid-cols-6 gap-4 py-3">
                {Array.from({ length: 6 }).map((_, j) => (
                  <Skeleton key={j} className="h-4 w-full" />
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 