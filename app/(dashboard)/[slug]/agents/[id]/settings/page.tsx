import { createClient } from "@/lib/supabase/server"
import { getAuthSession } from "@/lib/auth"
import { notFound } from "next/navigation"
import { AgentConfigurationForm } from "@/components/agent-configuration-form"
import type { AgentConfiguration } from "@/types/agent-config"

type PageProps = {
  params: Promise<{ id: string, slug: string }>
}

export default async function AgentSettingsPage({ params }: PageProps) {
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

  // Parse configuration safely
  const configuration = agent.configuration 
    ? (typeof agent.configuration === 'string' 
        ? JSON.parse(agent.configuration) 
        : agent.configuration) as AgentConfiguration
    : undefined

  return (
    <div className="space-y-4 mt-6">
      <AgentConfigurationForm 
        agentId={agent.id}
        slug={slug}
        initialConfig={configuration}
        mode="models"
      />
    </div>
  )
}

