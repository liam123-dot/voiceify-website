import { requireAdmin } from "@/app/(admin)/lib/admin-auth"
import { WorkOS } from '@workos-inc/node'
import { createServiceClient } from "@/lib/supabase/server"
import { AdminDashboardContainer } from "@/components/dashboard/admin-dashboard-container"

export default async function AdminPage() {
  const { user } = await requireAdmin()

  // Initialize WorkOS client
  const workos = new WorkOS(process.env.WORKOS_API_KEY!)

  // Fetch all organizations from our database to get slugs
  const supabase = await createServiceClient()
  const { data: dbOrgs, error: dbError } = await supabase
    .from('organisations')
    .select('id, external_id, slug')

  // Fetch organization details from WorkOS
  let organizations: Array<{ id: string; slug: string; name: string }> = []

  if (!dbError) {
    try {
      const result = await workos.organizations.listOrganizations()
      // Merge WorkOS data with our database data (slugs)
      organizations = result.data
        .map((workosOrg) => {
          const dbOrg = dbOrgs?.find(o => o.external_id === workosOrg.id)
          if (!dbOrg?.slug) return null
          return {
            id: workosOrg.id,
            slug: dbOrg.slug,
            name: workosOrg.name
          }
        })
        .filter((org): org is { id: string; slug: string; name: string } => org !== null)
    } catch (e) {
      console.error('Error fetching organizations:', e)
    }
  }

  return (
    <div className="space-y-6">
      <div className="px-4 lg:px-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Welcome back, {user?.email}
          </p>
        </div>
      </div>
      
      <AdminDashboardContainer organizations={organizations} />
    </div>
  )
}