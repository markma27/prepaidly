'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export function LoadingProgress() {
  const pathname = usePathname()
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    // Start loading when pathname changes
    setIsLoading(true)
    setProgress(0)

    // Simulate progress
    const progressTimer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressTimer)
          return 90
        }
        return prev + Math.random() * 30
      })
    }, 100)

    // Complete loading after a delay
    const completeTimer = setTimeout(() => {
      setProgress(100)
      setTimeout(() => {
        setIsLoading(false)
        setProgress(0)
      }, 200)
    }, 300)

    return () => {
      clearInterval(progressTimer)
      clearTimeout(completeTimer)
    }
  }, [pathname])

  if (!isLoading) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <div
        className={cn(
          "h-0.5 bg-primary transition-all duration-300 ease-out",
          "animate-in slide-in-from-left duration-200"
        )}
        style={{ width: `${progress}%` }}
      />
    </div>
  )
} 