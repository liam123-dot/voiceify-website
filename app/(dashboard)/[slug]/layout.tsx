
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { getAuthSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getSignInUrl } from "@workos-inc/authkit-nextjs"

type DashboardLayoutProps = {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}

export default async function DashboardLayout({
  children,
  params,
}: DashboardLayoutProps) {
  const { slug: requestedSlug } = await params
  const { user, organizationId, slug } = await getAuthSession(requestedSlug)

  // If organizationId is undefined, user doesn't have access to this slug
  if (!organizationId) {
    if (user && slug) {
      // User is logged in but accessing wrong org - redirect to their org
      redirect(`/${slug}`)
    } else {
      // User is not logged in - redirect to sign in
      const signInUrl = await getSignInUrl()
      redirect(signInUrl)
    }
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" slug={requestedSlug} />
      <SidebarInset>
        <SiteHeader slug={requestedSlug} />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              {children}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
