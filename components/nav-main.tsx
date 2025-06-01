"use client"

import { type Icon } from "@tabler/icons-react"
import Link from "next/link"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
  currentEntityId,
}: {
  items: {
    title: string
    url: string
    icon?: Icon
    disabled?: boolean
  }[]
  currentEntityId?: string
}) {
  return (
    <SidebarGroup>
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
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              ) : (
                <Link href={currentEntityId ? `${item.url}?entity=${currentEntityId}` : item.url}>
                  <SidebarMenuButton tooltip={item.title} className="w-full">
                    {item.icon && <item.icon />}
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
