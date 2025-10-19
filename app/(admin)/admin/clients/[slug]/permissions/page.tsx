import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PermissionsTable } from "./permissions-table"
import { getOrg } from "@/lib/auth"

interface PermissionsPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function PermissionsPage({ params }: PermissionsPageProps) {
  const { id } = await params

  // Fetch the organization to get current permissions
  let organisation
  try {
    organisation = await getOrg(id)
  } catch (e) {
    console.error('Error fetching organization:', e)
  }

  return (
    <div className="space-y-4 mt-6">
      <Card>
        <CardHeader>
          <CardTitle>Organization Permissions</CardTitle>
          <CardDescription>
            Configure access permissions for this organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PermissionsTable 
            organizationId={id} 
            initialPermissions={organisation?.permissions}
          />
        </CardContent>
      </Card>
    </div>
  )
}

