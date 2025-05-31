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
} from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
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
}

export function AppSidebar({ user, ...props }: AppSidebarProps) {
  const data = {
    user: {
      name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || "User",
      email: user?.email || "user@example.com",
      avatar: user?.user_metadata?.avatar_url || "/avatars/default.jpg",
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
              <a href="/dashboard">
                <IconTrendingUp className="!size-5" />
                <span className="text-base font-semibold">Prepaidly.io</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <div className="mt-auto">
          <div className="px-3 py-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Reports (Coming Soon)
            </h4>
          </div>
          <NavSecondary items={data.reports} />
        </div>
        <NavSecondary items={data.navSecondary} className="mt-4" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
