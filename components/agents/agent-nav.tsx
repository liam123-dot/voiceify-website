'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface AgentNavProps {
  agentId: string
  slug: string
}

export function AgentNav({ agentId, slug }: AgentNavProps) {
  const pathname = usePathname()

  const isActive = (path: string) => {
    if (path === `/${slug}/agents/${agentId}`) {
      return pathname === path
    }
    return pathname.startsWith(path)
  }

  return (
    <div className="flex gap-2 border-b">
      <Link 
        href={`/${slug}/agents/${agentId}`}
        prefetch={true}
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "rounded-b-none border-b-2",
          isActive(`/${slug}/agents/${agentId}`) 
            ? "border-primary" 
            : "border-transparent"
        )}
      >
        Configuration
      </Link>
      <Link 
        href={`/${slug}/agents/${agentId}/settings`}
        prefetch={true}
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "rounded-b-none border-b-2",
          isActive(`/${slug}/agents/${agentId}/settings`) 
            ? "border-primary" 
            : "border-transparent"
        )}
      >
        Settings
      </Link>
      <Link 
        href={`/${slug}/agents/${agentId}/deployment`}
        prefetch={true}
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "rounded-b-none border-b-2",
          isActive(`/${slug}/agents/${agentId}/deployment`) 
            ? "border-primary" 
            : "border-transparent"
        )}
      >
        Deployment
      </Link>
      <Link 
        href={`/${slug}/agents/${agentId}/tools`}
        prefetch={true}
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "rounded-b-none border-b-2",
          isActive(`/${slug}/agents/${agentId}/tools`) 
            ? "border-primary" 
            : "border-transparent"
        )}
      >
        Tools
      </Link>
      <Link 
        href={`/${slug}/agents/${agentId}/knowledge-bases`}
        prefetch={true}
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "rounded-b-none border-b-2",
          isActive(`/${slug}/agents/${agentId}/knowledge-bases`) 
            ? "border-primary" 
            : "border-transparent"
        )}
      >
        Knowledge Bases
      </Link>
    </div>
  )
}

