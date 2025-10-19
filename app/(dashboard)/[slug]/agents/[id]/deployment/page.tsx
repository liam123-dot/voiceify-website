import { AgentDeployment } from "@/components/agents/agent-deployment"
import { AgentRules } from "@/components/agents/agent-rules"

type PageProps = {
  params: Promise<{ slug: string; id: string }>
}

export default async function AgentDeploymentPage({ params }: PageProps) {
  const { slug, id } = await params

  return (
    <div className="space-y-6 mt-6">
      <AgentDeployment agentId={id} />
      <AgentRules agentId={id} slug={slug} />
    </div>
  )
}

