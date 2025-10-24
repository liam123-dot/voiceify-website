import { AgentEvaluations } from "@/components/agents/agent-evaluations"

type PageProps = {
  params: Promise<{ slug: string; id: string }>
}

export default async function AgentEvaluationsPage({ params }: PageProps) {
  const { slug, id } = await params

  return (
    <div className="space-y-4 mt-6">
      <AgentEvaluations agentId={id} slug={slug} />
    </div>
  )
}

