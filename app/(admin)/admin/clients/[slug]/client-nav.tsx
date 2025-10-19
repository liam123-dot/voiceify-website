'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ClientNavProps {
  clientSlug: string
}

export function ClientNav({ clientSlug }: ClientNavProps) {
  const pathname = usePathname()

  const isActive = (path: string) => {
    if (path === `/admin/clients/${clientSlug}`) {
      return pathname === path
    }
    return pathname.startsWith(path)
  }

  return (
    <div className="flex gap-2 border-b">
      <Link 
        href={`/admin/clients/${clientSlug}`}
        prefetch={true}
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "rounded-b-none border-b-2",
          isActive(`/admin/clients/${clientSlug}`) && pathname === `/admin/clients/${clientSlug}`
            ? "border-primary" 
            : "border-transparent"
        )}
      >
        Users
      </Link>
      <Link 
        href={`/admin/clients/${clientSlug}/knowledge-bases`}
        prefetch={true}
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "rounded-b-none border-b-2",
          isActive(`/admin/clients/${clientSlug}/knowledge-bases`) 
            ? "border-primary" 
            : "border-transparent"
        )}
      >
        Knowledge Bases
      </Link>
      <Link 
        href={`/admin/clients/${clientSlug}/agents`}
        prefetch={true}
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "rounded-b-none border-b-2",
          isActive(`/admin/clients/${clientSlug}/agents`) 
            ? "border-primary" 
            : "border-transparent"
        )}
      >
        Agents
      </Link>
      <Link 
        href={`/admin/clients/${clientSlug}/credentials`}
        prefetch={true}
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "rounded-b-none border-b-2",
          isActive(`/admin/clients/${clientSlug}/credentials`) 
            ? "border-primary" 
            : "border-transparent"
        )}
      >
        Credentials
      </Link>
      <Link 
        href={`/admin/clients/${clientSlug}/permissions`}
        prefetch={true}
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "rounded-b-none border-b-2",
          isActive(`/admin/clients/${clientSlug}/permissions`) 
            ? "border-primary" 
            : "border-transparent"
        )}
      >
        Permissions
      </Link>
      <Link 
        href={`/admin/clients/${clientSlug}/products`}
        prefetch={true}
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "rounded-b-none border-b-2",
          isActive(`/admin/clients/${clientSlug}/products`) 
            ? "border-primary" 
            : "border-transparent"
        )}
      >
        Products
      </Link>
    </div>
  )
}

