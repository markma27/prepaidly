'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

interface EntitySwitchingContextType {
  isEntitySwitching: boolean
  currentEntityId: string | null
  switchEntity: (entityId: string) => Promise<void>
  setEntitySwitching: (switching: boolean) => void
}

const EntitySwitchingContext = createContext<EntitySwitchingContextType | undefined>(undefined)

export function EntitySwitchingProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isEntitySwitching, setIsEntitySwitching] = useState(false)
  const [currentEntityId, setCurrentEntityId] = useState<string | null>(null)

  useEffect(() => {
    const entityParam = searchParams.get('entity')
    if (entityParam && entityParam !== currentEntityId) {
      setCurrentEntityId(entityParam)
    }
  }, [searchParams, currentEntityId])

  const switchEntity = async (entityId: string) => {
    if (entityId === currentEntityId || isEntitySwitching) return

    // Start synchronized loading across all components
    setIsEntitySwitching(true)
    
    try {
      // Store in localStorage
      localStorage.setItem('selectedEntityId', entityId)
      
      // Navigate to dashboard with new entity
      router.push(`/dashboard?entity=${entityId}`)
      
      // Keep loading state for consistent duration
      await new Promise(resolve => setTimeout(resolve, 1000))
      
    } finally {
      setIsEntitySwitching(false)
      setCurrentEntityId(entityId)
    }
  }

  const setEntitySwitching = (switching: boolean) => {
    setIsEntitySwitching(switching)
  }

  return (
    <EntitySwitchingContext.Provider value={{
      isEntitySwitching,
      currentEntityId,
      switchEntity,
      setEntitySwitching
    }}>
      {children}
    </EntitySwitchingContext.Provider>
  )
}

export function useEntitySwitching() {
  const context = useContext(EntitySwitchingContext)
  if (context === undefined) {
    throw new Error('useEntitySwitching must be used within an EntitySwitchingProvider')
  }
  return context
} 