'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChartAreaInteractive } from '@/components/chart-area-interactive'
import { SectionCards } from '@/components/section-cards'
import type { Call } from '@/types/call-events'

interface AnalyticsResponse {
  calls: Call[]
}

interface DashboardContainerProps {
  slug: string
}

export function DashboardContainer({ slug }: DashboardContainerProps) {
  const [timeRange, setTimeRange] = useState('7d')
  const [groupBy, setGroupBy] = useState<'day' | 'hour'>('day')

  // Fetch analytics data with React Query
  const { data, isLoading } = useQuery<AnalyticsResponse>({
    queryKey: ['analytics', slug],
    queryFn: async () => {
      const response = await fetch(`/api/${slug}/analytics`)
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data')
      }
      return response.json()
    },
    staleTime: 60 * 1000, // Consider data fresh for 1 minute
  })

  if (isLoading) {
    return (
      <div className="px-4 lg:px-6 py-8">
        <div className="text-center text-muted-foreground">
          Loading dashboard...
        </div>
      </div>
    )
  }

  const calls = data?.calls || []

  return (
    <>
      <SectionCards calls={calls} timeRange={timeRange} />
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive 
          calls={calls} 
          timeRange={timeRange}
          groupBy={groupBy}
          onTimeRangeChange={setTimeRange}
          onGroupByChange={setGroupBy}
        />
      </div>
    </>
  )
}

