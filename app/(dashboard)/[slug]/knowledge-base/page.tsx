'use client'

import { use } from 'react'
import { KnowledgeBaseList } from '@/components/knowledge-base/KnowledgeBaseList'

export default function KnowledgeBasePage ({ params }: { params: Promise<{ slug: string }> }) {
  // Unwrap params using use() for client component
  const { slug } = use(params)

  return (
    <div className="space-y-6 px-4 lg:px-6">

      <KnowledgeBaseList slug={slug} />
    </div>
  )

}
