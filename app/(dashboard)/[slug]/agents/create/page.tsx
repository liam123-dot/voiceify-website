import { CreateAgentForm } from "@/components/agents/create-agent-form"

type CreateAgentPageProps = {
  params: Promise<{ slug: string }>
}

export default async function CreateAgentPage({ params }: CreateAgentPageProps) {
  const { slug } = await params

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="max-w-2xl">
        <div className="space-y-2 mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Create Agent</h1>
          <p className="text-muted-foreground">
            Create a new AI voice agent for your organization.
          </p>
        </div>
        <CreateAgentForm slug={slug} />
      </div>
    </div>
  )
}

