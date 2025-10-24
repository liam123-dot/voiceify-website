'use client'

import { use } from 'react'
import { KnowledgeBaseItemsTable } from '@/components/knowledge-base/KnowledgeBaseItemsTable'

export default function KnowledgeBaseDetailPage({
  params
}: {
  params: Promise<{ slug: string; id: string }>
}) {
  const { slug, id } = use(params)

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <KnowledgeBaseItemsTable 
        slug={slug} 
        knowledgeBaseId={id} 
      />
    </div>
  )
}
