import { CallsContainer } from "@/components/calls/calls-container"

interface ClientCallsPageProps {
  params: Promise<{
    slug: string
  }>
}

export default async function ClientCallsPage({ params }: ClientCallsPageProps) {

  const { slug } = await params

  return (
    <div className="space-y-4 mt-6">
      <CallsContainer slug={slug} showEvents={true}/>
    </div>
  )
}