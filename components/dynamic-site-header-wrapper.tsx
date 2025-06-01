'use client'

import { useState, useEffect } from 'react'
import { DynamicSiteHeader } from './dynamic-site-header'

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

interface DynamicSiteHeaderWrapperProps {
  user: User
}

export function DynamicSiteHeaderWrapper({ user }: DynamicSiteHeaderWrapperProps) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)

  // Fetch user profile data
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.id) return
      
      try {
        const response = await fetch('/api/users/profile-info')
        if (response.ok) {
          const result = await response.json()
          setUserProfile(result.profile)
        }
      } catch (error) {
        console.error('Error fetching user profile:', error)
      }
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

  return <DynamicSiteHeader user={user} userProfile={userProfile} />
} 