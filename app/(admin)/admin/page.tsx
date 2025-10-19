import { withAuth } from "@workos-inc/authkit-nextjs"

export default async function AdminPage() {
  const { user } = await withAuth();

  return (
    <div className="px-4 lg:px-6">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Welcome back, {user?.email}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold">Products</h3>
            <p className="text-sm text-muted-foreground mt-1">Manage subscription products</p>
          </div>
        </div>
      </div>
    </div>
  )
}