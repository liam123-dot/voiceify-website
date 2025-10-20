import { CallsContainer } from '@/components/calls/calls-container'

interface CallsPageProps {
  params: Promise<{
    slug: string
  }>
}

export default async function CallsPage({ params }: CallsPageProps) {
  const { slug } = await params
  
  return <CallsContainer slug={slug} />
}
