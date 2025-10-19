'use client'

import { use } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { KnowledgeBaseItemsTable } from '@/components/knowledge-base/KnowledgeBaseItemsTable'
import { AddItemDialog } from '@/components/knowledge-base/AddItemDialog'

export default function KnowledgeBaseDetailPage({
  params
}: {
  params: Promise<{ slug: string; id: string }>
}) {
  const { slug, id } = use(params)
  const queryClient = useQueryClient()

  const handleItemAdded = () => {
    // Invalidate and refetch the items table
    queryClient.invalidateQueries({ queryKey: ['knowledge-base-items', slug, id] })
  }

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex items-center justify-end">
        <AddItemDialog 
          slug={slug} 
          knowledgeBaseId={id} 
          onItemAdded={handleItemAdded}
        />
      </div>

      <KnowledgeBaseItemsTable 
        slug={slug} 
        knowledgeBaseId={id} 
      />
    </div>
  )
}

