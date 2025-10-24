
import { KnowledgeBaseList } from '@/components/knowledge-base/KnowledgeBaseList'
interface KnowledgeBasesPageProps {
  params: Promise<{
    slug: string
  }>
}

export default async function KnowledgeBasesPage({ params }: KnowledgeBasesPageProps) {
  const { slug } = await params

  return (
    <div className="space-y-4 mt-6">
      <KnowledgeBaseList slug={slug} />
    </div>
  )
}

