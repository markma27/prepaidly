"use client"

import * as React from "react"
import {
  IconCalendar,
  IconChartBar,
  IconDashboard,
  IconFileSpreadsheet,
  IconHelp,
  IconListDetails,
  IconLogout,
  IconPlus,
  IconReport,
  IconSettings,
  IconTrendingUp,
  IconUser,
  IconUsers,
} from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import SidebarEntitySelector from "@/components/SidebarEntitySelector"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
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
  currentEntityId?: string
  currentUserRole?: string
  onEntityChange?: (entityId: string) => void
}

export function AppSidebar({ user, userProfile, currentEntityId, currentUserRole, onEntityChange, ...props }: AppSidebarProps) {
  // Create display name from profile data if available, otherwise fallback to user metadata or email
  const getDisplayName = () => {
    if (userProfile?.first_name && userProfile?.last_name) {
      return `${userProfile.first_name} ${userProfile.last_name}`
    }
    if (userProfile?.first_name) {
      return userProfile.first_name
    }
    return user?.user_metadata?.full_name || user?.email?.split('@')[0] || "User"
  }

  const data = {
    user: {
      name: getDisplayName(),
      email: user?.email || "user@example.com",
      avatar: userProfile?.avatar_url || user?.user_metadata?.avatar_url || "/avatars/default.jpg",
    },
    navMain: [
      {
        title: "Dashboard",
        url: "/dashboard",
        icon: IconDashboard,
      },
      {
        title: "New Schedule",
        url: "/new-schedule",
        icon: IconPlus,
      },
      {
        title: "Schedule Register",
        url: "/register",
        icon: IconListDetails,
      },
      {
        title: "Analytics",
        url: "#",
        icon: IconChartBar,
        disabled: true,
      },
    ],
    navSecondary: [
      // Only show User Management for admins and super_admins
      ...(currentUserRole && ['super_admin', 'admin'].includes(currentUserRole) ? [{
        title: "User Management",
        url: "/users",
        icon: IconUsers,
        disabled: false,
      }] : []),
      {
        title: "Profile",
        url: "/profile",
        icon: IconUser,
        disabled: false,
      },
      {
        title: "Settings",
        url: "/settings",
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
    reports: [
      {
        title: "Monthly Reports",
        url: "#",
        icon: IconReport,
        disabled: true,
      },
      {
        title: "CSV Exports",
        url: "#",
        icon: IconFileSpreadsheet,
        disabled: true,
      },
      {
        title: "Audit Trail",
        url: "#",
        icon: IconCalendar,
        disabled: true,
      },
    ],
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href={currentEntityId ? `/dashboard?entity=${currentEntityId}` : "/dashboard"}>
                <IconTrendingUp className="!size-5" />
                <span className="text-base font-semibold">Prepaidly.io</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarEntitySelector 
          currentEntityId={currentEntityId}
          onEntityChange={onEntityChange}
        />
        <NavMain items={data.navMain} currentEntityId={currentEntityId} />
        <div className="mt-auto">
          <div className="px-3 py-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Reports (Coming Soon)
            </h4>
          </div>
          <NavSecondary items={data.reports} currentEntityId={currentEntityId} />
        </div>
        <NavSecondary items={data.navSecondary} currentEntityId={currentEntityId} className="mt-4" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
