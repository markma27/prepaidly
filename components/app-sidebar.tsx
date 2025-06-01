"use client"

import {
  Command,
  Calendar,
  CreditCard,
  BarChart3,
} from "lucide-react"
import { 
  IconUsers,
  IconSettings,
  IconHelp,
  IconListDetails,
  IconDashboard,
  IconPlus,
} from "@tabler/icons-react"

import { Separator } from "@/components/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { NavUser } from './nav-user'
import { NavSecondary } from './nav-secondary'
import SidebarEntitySelector from './SidebarEntitySelector'
import Link from 'next/link'
import { cn } from "@/lib/utils"
import { useSearchParams } from 'next/navigation'

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

interface AppSidebarProps {
  user: User
  userProfile?: UserProfile | null
  variant?: "sidebar" | "floating" | "inset"
  currentEntityId?: string
  currentUserRole?: string
}

export function AppSidebar({ 
  user, 
  userProfile, 
  variant, 
  currentEntityId, 
  currentUserRole
}: AppSidebarProps) {
  const searchParams = useSearchParams()
  const entityParam = searchParams.get('entity') || currentEntityId

  // Main navigation items
  const data = {
    navMain: [
      {
        title: "Dashboard",
        url: `/dashboard?entity=${entityParam}`,
        icon: IconDashboard,
        isActive: true,
      },
      {
        title: "New Schedule", 
        url: `/new-schedule?entity=${entityParam}`,
        icon: IconPlus,
      },
      {
        title: "Schedule Register",
        url: `/register?entity=${entityParam}`,
        icon: IconListDetails,
      },
    ],
    navSecondary: [
      // Only show User Management for admins and super_admins
      ...(currentUserRole && ['super_admin', 'admin'].includes(currentUserRole) ? [{
        title: "User Management",
        url: `/users?entity=${entityParam}`,
        icon: IconUsers,
        disabled: false,
      }] : []),
      {
        title: "Settings",
        url: `/settings?entity=${entityParam}`,
        icon: IconSettings,
        disabled: false,
      },
      {
        title: "Help & Support",
        url: "#",
        icon: IconHelp,
        disabled: true,
      },
    ],
  }

  return (
    <Sidebar variant={variant} collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href={`/dashboard?entity=${entityParam}`}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Command className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Prepaidly.io</span>
                  <span className="truncate text-xs">SaaS Platform</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        
        {/* Entity Selector */}
        <SidebarEntitySelector 
          currentEntityId={currentEntityId}
        />
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {data.navMain.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild>
                  <Link href={item.url} className="cursor-pointer">
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
        
        {/* Secondary Navigation at the bottom */}
        <div className="mt-auto">
          <NavSecondary items={data.navSecondary} currentEntityId={entityParam} className="mt-4" />
        </div>
      </SidebarContent>
      
      <SidebarFooter>
        <NavUser user={{
          name: userProfile?.first_name && userProfile?.last_name 
            ? `${userProfile.first_name} ${userProfile.last_name}`
            : userProfile?.first_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || "User",
          email: user?.email || "user@example.com",
          avatar: userProfile?.avatar_url || user?.user_metadata?.avatar_url || "/avatars/default.jpg"
        }} />
      </SidebarFooter>
    </Sidebar>
  )
}
