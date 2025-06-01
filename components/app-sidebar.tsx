"use client"

import {
  AudioWaveform,
  BookOpen,
  Bot,
  Command,
  Frame,
  GalleryVerticalEnd,
  Map,
  SquareTerminal,
  Calendar,
  CreditCard,
  BarChart3,
  Users,
  LogOut,
  User,
  Sliders,
} from "lucide-react"
import { IconChartPie, IconSettings } from "@tabler/icons-react"

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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
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
        icon: BarChart3,
        isActive: true,
      },
      {
        title: "New Schedule", 
        url: `/new-schedule?entity=${entityParam}`,
        icon: Calendar,
      },
      {
        title: "Schedule Register",
        url: `/schedule-register?entity=${entityParam}`,
        icon: CreditCard,
      },
    ],
    navSecondary: [
      {
        title: "Analytics",
        url: `/analytics?entity=${entityParam}`,
        icon: IconChartPie,
      },
    ],
  }

  // Role-based access control
  const hasSettingsAccess = currentUserRole === 'admin' || currentUserRole === 'super_admin'

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
        
        <SidebarGroup>
          <NavSecondary items={data.navSecondary} className="mt-auto" />
        </SidebarGroup>

        {/* Entity Management - Admin Only */}
        {hasSettingsAccess && (
          <SidebarGroup>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href={`/entities?entity=${entityParam}`} className="cursor-pointer">
                    <IconSettings />
                    <span>Entity Management</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}
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
