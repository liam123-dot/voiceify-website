import { CreateKnowledgeBaseForm } from "@/components/knowledge-base/CreateKnowledgeBaseForm"

type PageProps = {
  params: Promise<{ slug: string }>
}

export default async function CreateKnowledgeBasePage({ params }: PageProps) {
  const { slug } = await params

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="max-w-2xl">
        <div className="space-y-2 mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Create Knowledge Base</h1>
          <p className="text-muted-foreground">
            Create a new knowledge base to organize your documents, files, and information.
          </p>
        </div>
        <CreateKnowledgeBaseForm slug={slug} />
      </div>
    </div>
  )
}

