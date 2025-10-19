import { AgentTools } from "@/components/agents/agent-tools"

type PageProps = {
  params: Promise<{ slug: string; id: string }>
}

export default async function AgentToolsPage({ params }: PageProps) {
  const { slug, id } = await params

  return (
    <div className="space-y-4 mt-6">
      <AgentTools agentId={id} slug={slug} />
    </div>
  )
}

