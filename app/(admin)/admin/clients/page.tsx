import { withAuth } from "@workos-inc/authkit-nextjs"
import { WorkOS } from '@workos-inc/node'
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createServiceClient } from "@/lib/supabase/server"

export default async function ClientsPage() {
  const { user } = await withAuth()

  // Initialize WorkOS client
  const workos = new WorkOS(process.env.WORKOS_API_KEY!)

  // Fetch all organizations from our database to get slugs
  const supabase = await createServiceClient()
  const { data: dbOrgs, error: dbError } = await supabase
    .from('organisations')
    .select('id, external_id, slug')

  // Fetch organization details from WorkOS
  type WorkOSOrg = Awaited<ReturnType<typeof workos.organizations.listOrganizations>>['data'][number]
  type OrgWithSlug = WorkOSOrg & { slug?: string }
  let organizations: OrgWithSlug[] = []
  let error: string | null = null

  if (dbError) {
    error = 'Failed to load organizations from database'
  } else {
    try {
      const result = await workos.organizations.listOrganizations()
      // Merge WorkOS data with our database data (slugs)
      organizations = result.data.map((workosOrg) => {
        const dbOrg = dbOrgs?.find(o => o.external_id === workosOrg.id)
        return {
          ...workosOrg,
          slug: dbOrg?.slug
        }
      }).filter((org): org is OrgWithSlug & { slug: string } => !!org.slug) // Only show orgs that exist in our database
    } catch (e) {
      console.error('Error fetching organizations:', e)
      error = 'Failed to load organizations'
    }
  }

  return (
    <div className="px-4 lg:px-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
            <p className="text-muted-foreground mt-2">
              View and manage all client organizations
            </p>
          </div>
        </div>

        {error ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        ) : organizations.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                No organizations found.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {organizations.map((org) => (
              <Link
                key={org.id}
                href={`/admin/clients/${org.slug}`}
                className="transition-transform hover:scale-[1.02]"
              >
                <Card className="h-full cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="truncate">{org.name}</span>
                      {org.allowProfilesOutsideOrganization && (
                        <Badge variant="secondary" className="ml-2">
                          Open
                        </Badge>
                      )}
                    </CardTitle>
                    {org.domains && org.domains.length > 0 && (
                      <CardDescription>
                        {org.domains.map((d: { domain: string }) => d.domain).join(', ')}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">ID:</span>
                        <span className="font-mono text-xs">{org.id}</span>
                      </div>
                      {org.createdAt && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Created:</span>
                          <span className="text-xs">
                            {new Date(org.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

