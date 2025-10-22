'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CallsTable } from '../calls-table'
import { Button } from '@/components/ui/button'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RefreshCwIcon, ChevronLeftIcon, ChevronRightIcon, FilterXIcon } from 'lucide-react'
import type { Call } from '@/types/call-events'

interface CallsResponse {
  calls: (Call & { agents?: { name: string } })[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface Agent {
  id: string
  name: string
}

interface CallsContainerProps {
  slug: string
  showEvents?: boolean
  showCosts?: boolean
  showTimeline?: boolean
  showLatency?: boolean
}

export function CallsContainer({ slug, showEvents = false, showCosts = false, showTimeline = false, showLatency = false }: CallsContainerProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [agentId, setAgentId] = useState<string>('all')
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date | undefined } | undefined>()

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [agentId, dateRange, limit])

  // Fetch agents for filter dropdown
  const { data: agentsData } = useQuery<{ agents: Agent[] }>({
    queryKey: ['agents', slug],
    queryFn: async () => {
      const response = await fetch(`/api/${slug}/agents`)
      if (!response.ok) {
        throw new Error('Failed to fetch agents')
      }
      return response.json()
    },
  })

  // Fetch calls with React Query
  // organizationSlug is included in the query key for proper cache isolation per organization
  const { data, isLoading, isRefetching, refetch } = useQuery<CallsResponse>({
    queryKey: ['calls', slug, currentPage, limit, agentId, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
      })
      
      // Only add agent_id if it's not 'all'
      if (agentId && agentId !== 'all') params.append('agent_id', agentId)
      if (dateRange?.from) params.append('date_from', dateRange.from.toISOString().split('T')[0])
      if (dateRange?.to) params.append('date_to', dateRange.to.toISOString().split('T')[0])

      const response = await fetch(`/api/${slug}/calls?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch calls')
      }
      return response.json()
    },
  })

  const handleRefresh = () => {
    refetch()
  }

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1))
  }

  const handleNextPage = () => {
    if (data?.pagination) {
      setCurrentPage((prev) => Math.min(data.pagination.totalPages, prev + 1))
    }
  }

  const handleResetFilters = () => {
    setAgentId('all')
    setDateRange(undefined)
  }

  const handleLimitChange = (value: string) => {
    setLimit(parseInt(value))
  }

  const hasActiveFilters = (agentId && agentId !== 'all') || dateRange !== undefined

  const calls = data?.calls || []
  const pagination = data?.pagination
  const agents = agentsData?.agents || []

  return (
    <div className="px-4 lg:px-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Calls</h1>
            <p className="text-muted-foreground">
              View and manage your voice calls
            </p>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={isRefetching}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCwIcon className={`size-4 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <div className="rounded-lg border bg-card p-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="agent-filter">Agent</Label>
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger id="agent-filter">
                  <SelectValue placeholder="All agents" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All agents</SelectItem>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date Range</Label>
              <DateRangePicker
                initialDateFrom={dateRange?.from}
                initialDateTo={dateRange?.to}
                onUpdate={(values) => setDateRange(values.range)}
                align="start"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="page-size">Page Size</Label>
              <Select value={limit.toString()} onValueChange={handleLimitChange}>
                <SelectTrigger id="page-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 per page</SelectItem>
                  <SelectItem value="20">20 per page</SelectItem>
                  <SelectItem value="50">50 per page</SelectItem>
                  <SelectItem value="100">100 per page</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="mt-4 flex justify-end">
              <Button
                onClick={handleResetFilters}
                variant="ghost"
                size="sm"
                className="gap-2"
              >
                <FilterXIcon className="size-4" />
                Clear Filters
              </Button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="rounded-lg border bg-card p-8 text-center">
            <p className="text-muted-foreground">Loading calls...</p>
          </div>
        ) : (
          <>
            <CallsTable calls={calls} slug={slug} showEvents={showEvents} showCosts={showCosts} showTimeline={showTimeline} />
            
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-2 py-4">
                <div className="text-sm text-muted-foreground">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                  {pagination.total} calls
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreviousPage}
                    disabled={currentPage === 1 || isRefetching}
                    className="gap-1"
                  >
                    <ChevronLeftIcon className="size-4" />
                    Previous
                  </Button>
                  <div className="text-sm font-medium">
                    Page {pagination.page} of {pagination.totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextPage}
                    disabled={currentPage === pagination.totalPages || isRefetching}
                    className="gap-1"
                  >
                    Next
                    <ChevronRightIcon className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

