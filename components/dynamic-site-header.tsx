"use client"

import { usePathname } from 'next/navigation'
import { SiteHeader } from './site-header'

interface DynamicSiteHeaderProps {
  user?: {
    id: string
    email?: string
    user_metadata?: any
  }
  userProfile?: {
    first_name?: string
    last_name?: string
    avatar_url?: string
  } | null
}

export function DynamicSiteHeader({ user, userProfile }: DynamicSiteHeaderProps) {
  const pathname = usePathname()
  
  const getPageTitle = (path: string) => {
    switch (true) {
      case path === '/dashboard':
        return 'Dashboard'
      case path === '/new-schedule':
        return 'Create New Schedule'
      case path === '/register':
        return 'Schedule Register'
      case path === '/settings':
        return 'Settings'
      case path.includes('/register/') && path.includes('/edit'):
        return 'Edit Schedule'
      default:
        return 'Prepaidly'
    }
  }

  return <SiteHeader user={user} userProfile={userProfile} title={getPageTitle(pathname)} />
} 