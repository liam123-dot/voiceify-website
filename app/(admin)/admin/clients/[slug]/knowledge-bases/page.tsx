import { withAuth } from "@workos-inc/authkit-nextjs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface KnowledgeBasesPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function KnowledgeBasesPage({ params }: KnowledgeBasesPageProps) {
  const { id } = await params
  const { user } = await withAuth()

  return (
    <div className="space-y-4 mt-6">
      <Card>
        <CardHeader>
          <CardTitle>Knowledge Bases</CardTitle>
          <CardDescription>
            Manage knowledge bases for this organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Knowledge base management coming soon...
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

