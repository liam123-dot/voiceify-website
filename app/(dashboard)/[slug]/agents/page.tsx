
import { AgentsList } from "@/components/agents/agents-list"

type AgentsPageProps = {
  params: Promise<{ slug: string }>
}

export default async function AgentsPage({ params }: AgentsPageProps) {
  const { slug } = await params

  return (
    <div className="px-4 lg:px-6">
      <div className="space-y-4">
        <AgentsList slug={slug} />
      </div>
    </div>
  )
}
