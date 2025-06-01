'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { AppSidebar } from './app-sidebar'

interface User {
  id: string
  email?: string
  user_metadata?: any
}

interface AppSidebarWrapperProps {
  user: User
  variant?: "sidebar" | "floating" | "inset"
}

export function AppSidebarWrapper({ user, variant }: AppSidebarWrapperProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [currentEntityId, setCurrentEntityId] = useState<string>('')

  useEffect(() => {
    // Get entity from URL params or localStorage
    const entityFromUrl = searchParams.get('entity')
    const entityFromStorage = localStorage.getItem('selectedEntityId')
    const defaultEntity = '00000000-0000-0000-0000-000000000001' // Demo Company

    const entityId = entityFromUrl || entityFromStorage || defaultEntity
    
    // Only update if different to prevent loops
    if (entityId !== currentEntityId) {
      setCurrentEntityId(entityId)
      
      // Store in localStorage for persistence
      if (entityId) {
        localStorage.setItem('selectedEntityId', entityId)
      }
    }
  }, [searchParams, currentEntityId])

  const handleEntityChange = (entityId: string) => {
    // Only proceed if different entity
    if (entityId === currentEntityId) return
    
    // Update state immediately to prevent UI flash
    setCurrentEntityId(entityId)
    localStorage.setItem('selectedEntityId', entityId)
    
    // Always navigate to dashboard when switching entities for better UX
    router.push(`/dashboard?entity=${entityId}`)
  }

  return (
    <AppSidebar 
      user={user}
      variant={variant}
      currentEntityId={currentEntityId}
      onEntityChange={handleEntityChange}
    />
  )
} 