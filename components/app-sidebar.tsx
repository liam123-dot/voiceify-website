"use client"

import * as React from "react"
import Link from "next/link"
import {
  IconDashboard,
  IconDeviceMobile,
  IconPhone,
  IconRobot,
  IconTools,
  IconBook,
  IconCheck,
} from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"
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
  slug: string
}

export function AppSidebar({ slug, ...props }: AppSidebarProps) {
  const navMain = [
    {
      title: "Dashboard",
      url: `/${slug}`,
      icon: IconDashboard,
    },
    {
      title: "Agents",
      url: `/${slug}/agents`,
      icon: IconRobot,
    },
    {
      title: "Tools",
      url: `/${slug}/tools`,
      icon: IconTools,
    },
    {
      title: "Knowledge Base",
      url: `/${slug}/knowledge-base`,
      icon: IconBook,
    },
    {
      title: "Phone Numbers",
      url: `/${slug}/phone-numbers`,
      icon: IconDeviceMobile,
    },
    {
      title: "Evaluations",
      url: `/${slug}/evaluations`,
      icon: IconCheck,
    },
    {
      title: "Calls",
      url: `/${slug}/calls`,
      icon: IconPhone,
    },
  ]

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link href={`/${slug}`} prefetch={true}>
                <span className="text-base font-semibold">Voiceify</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
