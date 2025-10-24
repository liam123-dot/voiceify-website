'use client'

import { use } from 'react'
import { EvaluationsList } from '@/components/evaluations/EvaluationsList'

export default function EvaluationsPage ({ params }: { params: Promise<{ slug: string }> }) {
  // Unwrap params using use() for client component
  const { slug } = use(params)

  return (
    <div className="space-y-6 px-4 lg:px-6">
      <EvaluationsList slug={slug} />
    </div>
  )
}