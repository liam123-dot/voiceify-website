import { WorkOS } from '@workos-inc/node'
import { Card, CardContent } from "@/components/ui/card"
import { createServiceClient } from "@/lib/supabase/server"
import {
  Table,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { IconBuilding } from "@tabler/icons-react"
import { ClientsTableBody } from "./clients-table-body"

const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
// const baseUrl = 'http://localhost:3000';

export default async function ClientsPage() {

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

  if (error) {
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
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (organizations.length === 0) {
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
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <IconBuilding />
              </EmptyMedia>
              <EmptyTitle>No Clients Yet</EmptyTitle>
              <EmptyDescription>
                No organizations found.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      </div>
    )
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

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {organizations.length} {organizations.length === 1 ? 'client' : 'clients'}
          </p>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12"></TableHead>
                  <TableHead className="font-semibold">Name</TableHead>
                  <TableHead className="font-semibold">Created</TableHead>
                  <TableHead className="text-right font-semibold w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <ClientsTableBody organizations={organizations} baseUrl={baseUrl || ''} />
            </Table>
          </div>
        </div>
      </div>
    </div>
  )
}

