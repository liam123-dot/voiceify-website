import { withAuth } from "@workos-inc/authkit-nextjs"
import { WorkOS } from '@workos-inc/node'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getOrgBySlug } from "@/lib/auth"

interface ClientPageProps {
  params: Promise<{
    slug: string
  }>
}

export default async function ClientUsersPage({ params }: ClientPageProps) {
  const { slug } = await params
  const { user } = await withAuth()

  // Get organization from database (creates if doesn't exist and syncs with WorkOS)
  let organisation
  try {
    organisation = await getOrgBySlug(slug)
  } catch (e) {
    console.error('Error fetching organization:', e)
  }

  // Initialize WorkOS client
  const workos = new WorkOS(process.env.WORKOS_API_KEY!)

  // Fetch users for this organization
  let users: Awaited<ReturnType<typeof workos.userManagement.listUsers>>['data'] = []
  let error: string | null = null

  try {
    console.log('Fetching users for organization:', organisation)
    const result = await workos.userManagement.listUsers({
      organizationId: organisation?.external_id
    })
    users = result.data
  } catch (e) {
    console.error('Error fetching users:', e)
    error = 'Failed to load users'
  }

  const getInitials = (firstName?: string, lastName?: string, email?: string) => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase()
    }
    if (firstName) {
      return firstName.substring(0, 2).toUpperCase()
    }
    if (email) {
      return email.substring(0, 2).toUpperCase()
    }
    return 'U'
  }

  return (
    <div className="space-y-4 mt-6">
      <Card>
        <CardHeader>
          <CardTitle>Organization Users</CardTitle>
          <CardDescription>
            View and manage users in this organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No users found in this organization.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.profilePictureUrl || undefined} />
                            <AvatarFallback className="text-xs">
                              {getInitials(user.firstName || undefined, user.lastName || undefined, user.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">
                              {user.firstName && user.lastName 
                                ? `${user.firstName} ${user.lastName}`
                                : user.firstName || user.lastName || 'No name'}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {user.id}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{user.email}</span>
                        {user.emailVerified && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            Verified
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.emailVerified ? 'default' : 'secondary'}>
                          {user.emailVerified ? 'Active' : 'Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.createdAt 
                          ? new Date(user.createdAt).toLocaleDateString()
                          : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Details Card */}
      {users.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
            <CardDescription>Organization user statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">{users.length}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Verified Users</p>
                <p className="text-2xl font-bold">
                  {users.filter(u => u.emailVerified).length}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Pending Users</p>
                <p className="text-2xl font-bold">
                  {users.filter(u => !u.emailVerified).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

