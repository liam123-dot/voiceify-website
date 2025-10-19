import { withAuth } from "@workos-inc/authkit-nextjs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface ProductsPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function ProductsPage({ params }: ProductsPageProps) {
  const { id } = await params
  const { user } = await withAuth()

  return (
    <div className="space-y-4 mt-6">
      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
          <CardDescription>
            Manage product subscriptions for this organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Product management coming soon...
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

