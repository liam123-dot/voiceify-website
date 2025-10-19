import { DashboardContainer } from '@/components/dashboard/dashboard-container'

interface DashboardPageProps {
  params: Promise<{
    slug: string
  }>
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { slug } = await params
  
  return <DashboardContainer slug={slug} />
}
