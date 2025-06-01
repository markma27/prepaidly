"use client"

import * as React from "react"
import { type Icon } from "@tabler/icons-react"
import Link from "next/link"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavSecondary({
  items,
  currentEntityId,
  ...props
}: {
  items: {
    title: string
    url: string
    icon: Icon
    disabled?: boolean
  }[]
  currentEntityId?: string
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              {item.disabled ? (
                <SidebarMenuButton 
                  tooltip={`${item.title} (Coming Soon)`}
                  disabled
                  className="opacity-60 cursor-not-allowed"
                >
                  <item.icon />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              ) : (
                <Link href={currentEntityId ? `${item.url}?entity=${currentEntityId}` : item.url}>
                  <SidebarMenuButton tooltip={item.title} className="w-full">
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </Link>
              )}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
