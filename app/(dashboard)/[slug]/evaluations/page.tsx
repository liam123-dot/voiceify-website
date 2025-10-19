type PageProps = {
  params: Promise<{ slug: string }>
}

export default async function EvaluationsPage({ params }: PageProps) {

  const { slug } = await params

  return (
    <div>
      <h1>Evaluations</h1>
    </div>
  )
}