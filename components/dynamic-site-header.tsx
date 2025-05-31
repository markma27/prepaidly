"use client"

import { usePathname } from 'next/navigation'
import { SiteHeader } from './site-header'

interface DynamicSiteHeaderProps {
  user?: {
    id: string
    email?: string
    user_metadata?: any
  }
}

export function DynamicSiteHeader({ user }: DynamicSiteHeaderProps) {
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

  return <SiteHeader user={user} title={getPageTitle(pathname)} />
} 