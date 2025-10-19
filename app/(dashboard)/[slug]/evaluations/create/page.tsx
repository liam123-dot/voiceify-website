import { CreateEvaluationForm } from "@/components/evaluations/CreateEvaluationForm"

type PageProps = {
  params: Promise<{ slug: string }>
}

export default async function CreateEvaluationPage({ params }: PageProps) {
  const { slug } = await params

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="max-w-5xl mx-auto">
        <div className="space-y-2 mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Create Evaluation</h1>
          <p className="text-muted-foreground">
            Create a new evaluation to process call transcripts and generate structured outputs.
          </p>
        </div>
        <CreateEvaluationForm slug={slug} />
      </div>
    </div>
  )
}

