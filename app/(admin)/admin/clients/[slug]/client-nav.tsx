'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ClientNavProps {
  clientSlug: string
}

interface NavItem {
  label: string
  href: string
  activePattern: string
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Users",
    href: "/admin/clients/[slug]",
    activePattern: "/admin/clients/[slug]",
  },
  {
    label: "Agents",
    href: "/admin/clients/[slug]/agents",
    activePattern: "/admin/clients/[slug]/agents",
  },
  {
    label: "Tools",
    href: "/admin/clients/[slug]/tools",
    activePattern: "/admin/clients/[slug]/tools",
  },
  {
    label: "Calls",
    href: "/admin/clients/[slug]/calls",
    activePattern: "/admin/clients/[slug]/calls",
  },
  {
    label: "Knowledge Bases",
    href: "/admin/clients/[slug]/knowledge-bases",
    activePattern: "/admin/clients/[slug]/knowledge-bases",
  },
  {
    label: "Credentials",
    href: "/admin/clients/[slug]/credentials",
    activePattern: "/admin/clients/[slug]/credentials",
  },
  {
    label: "Permissions",
    href: "/admin/clients/[slug]/permissions",
    activePattern: "/admin/clients/[slug]/permissions",
  },
  {
    label: "Products",
    href: "/admin/clients/[slug]/products",
    activePattern: "/admin/clients/[slug]/products",
  },

]

export function ClientNav({ clientSlug }: ClientNavProps) {
  const pathname = usePathname()

  const isActive = (path: string) => {
    const actualPath = path.replace("[slug]", clientSlug)
    if (path.endsWith("[slug]")) {
      return pathname === actualPath
    }
    return pathname.startsWith(actualPath)
  }

  return (
    <div className="flex gap-2 border-b">
      {NAV_ITEMS.map((item) => {
        const actualHref = item.href.replace("[slug]", clientSlug)
        const active = isActive(item.activePattern)

        return (
          <Link
            key={item.label}
            href={actualHref}
            prefetch={true}
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "rounded-b-none border-b-2",
              active ? "border-primary" : "border-transparent"
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </div>
  )
}

