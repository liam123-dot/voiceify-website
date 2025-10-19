import { EditEvaluationForm } from "@/components/evaluations/EditEvaluationForm"

type PageProps = {
  params: Promise<{ slug: string; id: string }>
}

export default async function EditEvaluationPage({ params }: PageProps) {
  const { slug, id } = await params

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="max-w-5xl mx-auto">
        <div className="space-y-2 mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Edit Evaluation</h1>
          <p className="text-muted-foreground">
            Update the evaluation settings and configuration.
          </p>
        </div>
        <EditEvaluationForm slug={slug} evaluationId={id} />
      </div>
    </div>
  )
}

