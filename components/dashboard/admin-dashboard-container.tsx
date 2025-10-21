'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChartAreaInteractive } from '@/components/chart-area-interactive'
import { ChartBarSegmented } from '@/components/chart-bar-segmented'
import { ChartKnowledgeLatency } from '@/components/chart-knowledge-latency'
import { ChartKnowledgeLatencyBreakdown } from '@/components/chart-knowledge-latency-breakdown'
import { SectionCards } from '@/components/section-cards'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type { Call } from '@/types/call-events'

interface CallWithOrg {
  id: string
  created_at: string
  duration_seconds: number | null
  status: string
  organization_id: string
  organization_slug: string
}

interface AnalyticsResponse {
  calls: CallWithOrg[]
}

interface KnowledgeEvent {
  id: string
  time: string
  call_id: string
  event_type: string
  data: {
    data?: {
      latency_ms?: number
      embedding_latency_ms?: number
      supabase_query_latency_ms?: number
    }
  }
  organization_id: string
  organization_slug: string
}

interface KnowledgeLatencyResponse {
  events: KnowledgeEvent[]
}

// Type for minimal call data used in analytics
type AnalyticsCall = Pick<Call, 'id' | 'created_at' | 'duration_seconds' | 'status'>

interface Organization {
  id: string
  slug: string
  name: string
}

interface AdminDashboardContainerProps {
  organizations: Organization[]
}

export function AdminDashboardContainer({ organizations }: AdminDashboardContainerProps) {
  const [selectedSlug, setSelectedSlug] = useState<string>('all')
  const [isSegmented, setIsSegmented] = useState(false)
  const [showLatencyBreakdown, setShowLatencyBreakdown] = useState(false)
  const [timeRange, setTimeRange] = useState('7d')
  const [groupBy, setGroupBy] = useState<'day' | 'hour'>('day')

  // Fetch analytics data with React Query
  const { data, isLoading } = useQuery<AnalyticsResponse>({
    queryKey: ['admin-analytics', selectedSlug],
    queryFn: async () => {
      const url = selectedSlug === 'all' 
        ? '/api/admin/analytics' 
        : `/api/admin/analytics?slug=${selectedSlug}`
      
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data')
      }
      return response.json()
    },
    staleTime: 60 * 1000, // Consider data fresh for 1 minute
  })

  // Fetch knowledge latency data
  const { data: knowledgeData, isLoading: isKnowledgeLoading } = useQuery<KnowledgeLatencyResponse>({
    queryKey: ['admin-knowledge-latency', selectedSlug],
    queryFn: async () => {
      const url = selectedSlug === 'all' 
        ? '/api/admin/knowledge-latency' 
        : `/api/admin/knowledge-latency?slug=${selectedSlug}`
      
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('Failed to fetch knowledge latency data')
      }
      return response.json()
    },
    staleTime: 60 * 1000, // Consider data fresh for 1 minute
  })

  // Reset segmentation when switching away from "All Clients"
  useEffect(() => {
    if (selectedSlug !== 'all') {
      setIsSegmented(false)
    }
  }, [selectedSlug])

  if (isLoading || isKnowledgeLoading) {
    return (
      <div className="px-4 lg:px-6 py-8">
        <div className="text-center text-muted-foreground">
          Loading dashboard...
        </div>
      </div>
    )
  }

  const calls = data?.calls || []
  const knowledgeEvents = knowledgeData?.events || []

  // Transform calls with org data to regular calls for non-segmented view
  const transformedCalls = calls.map(call => ({
    id: call.id,
    created_at: call.created_at,
    duration_seconds: call.duration_seconds,
    status: call.status,
  })) as AnalyticsCall[]

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="px-4 lg:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Label htmlFor="client-select" className="text-sm font-medium whitespace-nowrap">
              Client:
            </Label>
            <Select value={selectedSlug} onValueChange={setSelectedSlug}>
              <SelectTrigger id="client-select" className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.slug}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Segmentation toggle - only show when "All Clients" is selected */}
          {selectedSlug === 'all' && (
            <div className="flex items-center gap-3">
              <Switch
                id="segment-toggle"
                checked={isSegmented}
                onCheckedChange={setIsSegmented}
              />
              <Label htmlFor="segment-toggle" className="text-sm font-medium cursor-pointer">
                Segment by Client
              </Label>
            </div>
          )}
        </div>
      </div>

      {/* Analytics Cards */}
      <SectionCards calls={transformedCalls as Call[]} timeRange={timeRange} />

      {/* Charts */}
      <div className="px-4 lg:px-6 space-y-6">
        {isSegmented && selectedSlug === 'all' ? (
          <ChartBarSegmented
            calls={calls}
            timeRange={timeRange}
            groupBy={groupBy}
            onTimeRangeChange={setTimeRange}
            onGroupByChange={setGroupBy}
          />
        ) : (
          <ChartAreaInteractive
            calls={transformedCalls as Call[]}
            timeRange={timeRange}
            groupBy={groupBy}
            onTimeRangeChange={setTimeRange}
            onGroupByChange={setGroupBy}
          />
        )}

        {/* Knowledge Retrieval Latency Charts */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch
              id="latency-breakdown-toggle"
              checked={showLatencyBreakdown}
              onCheckedChange={setShowLatencyBreakdown}
            />
            <Label htmlFor="latency-breakdown-toggle" className="text-sm font-medium cursor-pointer">
              Show latency breakdown (Embedding + Supabase)
            </Label>
          </div>
          
          {showLatencyBreakdown ? (
            <ChartKnowledgeLatencyBreakdown
              events={knowledgeEvents}
              timeRange={timeRange}
              groupBy={groupBy}
              onTimeRangeChange={setTimeRange}
              onGroupByChange={setGroupBy}
            />
          ) : (
            <ChartKnowledgeLatency
              events={knowledgeEvents}
              timeRange={timeRange}
              groupBy={groupBy}
              onTimeRangeChange={setTimeRange}
              onGroupByChange={setGroupBy}
            />
          )}
        </div>
      </div>
    </div>
  )
}

