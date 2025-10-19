import { AgentsList } from "@/components/agents/agents-list"

interface AgentsPageProps {
  params: Promise<{
    slug: string
  }>
}

export default async function ClientAgentsPage({ params }: AgentsPageProps) {
  const { slug } = await params

  return (
    <div className="space-y-4 mt-6">
      <AgentsList slug={slug} />
    </div>
  )
}

