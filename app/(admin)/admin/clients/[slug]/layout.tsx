import { WorkOS } from '@workos-inc/node'
import { notFound } from "next/navigation"
import { ClientNav } from "./client-nav"
import { getOrgBySlug } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import Link from "next/link"

type LayoutProps = {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
// const baseUrl = 'http://localhost:3000';


export default async function ClientLayout({ children, params }: LayoutProps) {
  const { slug } = await params

  // Fetch organization from database by slug
  const org = await getOrgBySlug(slug)
  
  if (!org) {
    notFound()
  }

  // Initialize WorkOS client
  const workos = new WorkOS(process.env.WORKOS_API_KEY!);

  // Fetch organization details from WorkOS
  let organization: Awaited<ReturnType<typeof workos.organizations.getOrganization>> | null = null

  try {
    organization = await workos.organizations.getOrganization(org.external_id)
  } catch (e) {
    console.error('Error fetching organization from WorkOS:', e)
  }

  if (!organization) {
    notFound()
  }

  return (
    <div className="px-4 lg:px-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{organization.name}</h1>
              <p className="text-muted-foreground">
                Manage organization users, resources, and settings
              </p>
            </div>
            <Link href={`${baseUrl}/${slug}`} className="flex-shrink-0">
              <Button variant="outline" className="bg-white text-black hover:bg-white hover:text-black border-white">
                Access Dashboard
              </Button>
            </Link>
          </div>
        </div>

        {/* Navigation */}
        <ClientNav clientSlug={slug} />

        {/* Page Content */}
        {children}
      </div>
    </div>
  )
}

