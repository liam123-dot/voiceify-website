import { createClient } from "@/lib/supabase/server"
import { getAuthSession } from "@/lib/auth"
import { notFound } from "next/navigation"
import { EditToolForm } from "@/components/tools/edit-tool-form"

type PageProps = {
  params: Promise<{ slug: string; id: string }>
}

export default async function ToolPage({ params }: PageProps) {
  const { slug, id } = await params
  const { user, organizationId } = await getAuthSession(slug)

  if (!user || !organizationId) {
    notFound()
  }

  const supabase = await createClient()

  // Get the tool (RLS will ensure user can only see tools from their org)
  const { data: tool, error: toolError } = await supabase
    .from('tools')
    .select('*')
    .eq('id', id)
    .eq('organization_id', organizationId)
    .single()

  if (toolError || !tool) {
    notFound()
  }

  return (
    <div className="px-4 lg:px-6">
      <EditToolForm tool={tool} slug={slug} />
    </div>
  )
}

