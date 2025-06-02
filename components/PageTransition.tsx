'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface PageTransitionProps {
  children: React.ReactNode
}

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname()

  return (
    <div className="relative min-h-full">
      {/* Page content with smooth transitions */}
      <div 
        key={pathname}
        className="animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out"
      >
        {children}
      </div>
    </div>
  )
} 