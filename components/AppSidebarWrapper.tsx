'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { AppSidebar } from './app-sidebar'
import { withAuthErrorHandling } from '@/lib/authErrorHandler'

interface User {
  id: string
  email?: string
  user_metadata?: any
}

interface UserProfile {
  first_name?: string
  last_name?: string
  avatar_url?: string
}

interface AppSidebarWrapperProps {
  user: User
  variant?: "sidebar" | "floating" | "inset"
}

export function AppSidebarWrapper({ user, variant }: AppSidebarWrapperProps) {
  const searchParams = useSearchParams()
  const [currentEntityId, setCurrentEntityId] = useState<string>('')
  const [currentUserRole, setCurrentUserRole] = useState<string>('')
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)

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

  // Fetch user role for current entity
  useEffect(() => {
    const fetchUserRole = async () => {
      if (!currentEntityId || !user?.id) return
      
      await withAuthErrorHandling(async () => {
        const response = await fetch(`/api/users/role-info?entityId=${currentEntityId}`)
        if (response.ok) {
          const result = await response.json()
          setCurrentUserRole(result.role || '')
        } else {
          setCurrentUserRole('')
        }
      }).catch(error => {
        console.error('Error fetching user role:', error)
        setCurrentUserRole('')
      })
    }

    fetchUserRole()
  }, [currentEntityId, user?.id])

  // Fetch user profile data
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.id) return
      
      await withAuthErrorHandling(async () => {
        const response = await fetch('/api/users/profile-info')
        if (response.ok) {
          const result = await response.json()
          setUserProfile(result.profile)
        }
      }).catch(error => {
        console.error('Error fetching user profile:', error)
      })
    }

    fetchUserProfile()

    // Listen for profile updates
    const handleProfileUpdate = () => {
      fetchUserProfile()
    }

    window.addEventListener('profile-updated', handleProfileUpdate)

    return () => {
      window.removeEventListener('profile-updated', handleProfileUpdate)
    }
  }, [user?.id])

  return (
    <AppSidebar 
      user={user}
      userProfile={userProfile}
      variant={variant}
      currentEntityId={currentEntityId}
      currentUserRole={currentUserRole}
    />
  )
} 