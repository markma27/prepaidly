'use client'

import { createContext, useContext, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingContextType {
  isLoading: boolean
  loadingMessage: string
  setLoading: (loading: boolean, message?: string) => void
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined)

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')

  const setLoading = (loading: boolean, message: string = 'Loading...') => {
    setIsLoading(loading)
    setLoadingMessage(message)
  }

  return (
    <LoadingContext.Provider value={{ isLoading, loadingMessage, setLoading }}>
      {/* Global loading overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="space-y-1">
              <div className="text-lg font-medium">{loadingMessage}</div>
              <div className="text-sm text-muted-foreground">Please wait...</div>
            </div>
          </div>
        </div>
      )}
      {children}
    </LoadingContext.Provider>
  )
}

export function useLoading() {
  const context = useContext(LoadingContext)
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider')
  }
  return context
} 