'use client'

import { use } from 'react'
import { EstateAgentDetail } from '@/components/knowledge-base/estate-agents/EstateAgentDetail'

export default function EstateAgentDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string; itemId: string }>
}) {
  const { slug, id, itemId } = use(params)

  return <EstateAgentDetail slug={slug} knowledgeBaseId={id} estateAgentId={itemId} />
}

