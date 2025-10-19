import { createClient } from "@/lib/supabase/server"
import { getAuthSession } from "@/lib/auth"
import { notFound } from "next/navigation"
import { AgentNav } from "@/components/agents/agent-nav"

type LayoutProps = {
  children: React.ReactNode
  params: Promise<{ id: string, slug: string }>
}

export default async function AgentLayout({ children, params }: LayoutProps) {
  const { id, slug } = await params
  const { user, organizationId } = await getAuthSession(slug)

  if (!user || !organizationId) {
    notFound()
  }

  const supabase = await createClient()

  // Get the agent (RLS will ensure user can only see agents from their org)
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('*')
    .eq('id', id)
    .eq('organization_id', organizationId)
    .single()

  if (agentError || !agent) {
    notFound()
  }

  return (
    <div className="px-4 lg:px-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">{agent.name}</h1>
          <p className="text-muted-foreground">
            Configure your agent&apos;s behavior, voice, and settings
          </p>
        </div>

        {/* Navigation */}
        <AgentNav agentId={id} slug={slug} />

        {/* Page Content */}
        {children}
      </div>
    </div>
  )
}

