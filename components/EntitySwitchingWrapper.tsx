'use client'

import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEntitySwitching } from './EntitySwitchingContext'

interface EntitySwitchingWrapperProps {
  children: React.ReactNode
}

export function EntitySwitchingWrapper({ 
  children
}: EntitySwitchingWrapperProps) {
  const { isEntitySwitching } = useEntitySwitching()

  if (isEntitySwitching) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 animate-in fade-in duration-500">
            {/* Loading Message */}
            <div className="px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-4 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <div className="text-center">
                    <div className="text-lg font-medium mb-1">Switching organisation...</div>
                    <div className="text-sm">Loading dashboard data</div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Subtle background skeleton */}
            <div className="px-4 sm:px-6 lg:px-8 opacity-20">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-24 bg-muted rounded-lg animate-pulse"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      "flex flex-1 flex-col transition-all duration-500",
      "animate-in fade-in slide-in-from-bottom-2"
    )}>
      <div className="@container/main flex flex-1 flex-col gap-2">
        {children}
      </div>
    </div>
  )
} 