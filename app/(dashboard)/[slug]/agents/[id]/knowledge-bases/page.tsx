import { AgentKnowledgeBases } from "@/components/agents/agent-knowledge-bases"

type PageProps = {
  params: Promise<{ slug: string; id: string }>
}

export default async function AgentKnowledgeBasesPage({ params }: PageProps) {
  const { slug, id } = await params

  return (
    <div className="space-y-4 mt-6">
      <AgentKnowledgeBases agentId={id} slug={slug} />
    </div>
  )
}

