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

interface CallWithOrganization extends Call {
  organisations?: {
    slug: string
  }
  agents?: {
    name: string
  }
}

interface CallsResponse {
  calls: CallWithOrganization[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface Organization {
  id: string
  name: string
  slug: string
}

interface Agent {
  id: string
  name: string
}

interface WorkOSOrganization {
  id: string
  name: string
}

interface DBOrganization {
  id: string
  external_id: string
  slug: string
}

export function AdminCallsContainer() {
  const [currentPage, setCurrentPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [organizationSlug, setOrganizationSlug] = useState<string>('all')
  const [agentId, setAgentId] = useState<string>('all')
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date | undefined } | undefined>()

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [organizationSlug, agentId, dateRange, limit])

  // Fetch organizations for filter dropdown
  const { data: organizationsData } = useQuery<{ organizations: Organization[] }>({
    queryKey: ['admin-organizations-with-slugs'],
    queryFn: async () => {
      // Fetch WorkOS organizations
      const workosResponse = await fetch('/api/admin/organizations')
      if (!workosResponse.ok) {
        throw new Error('Failed to fetch organizations')
      }
      const workosData = await workosResponse.json()
      
      // Fetch database organizations with slugs
      const dbResponse = await fetch('/api/admin/organizations/slugs')
      if (!dbResponse.ok) {
        throw new Error('Failed to fetch organization slugs')
      }
      const dbData = await dbResponse.json()
      
      // Merge WorkOS data (names) with database data (slugs)
      const organizations = workosData.organizations
        .map((workosOrg: WorkOSOrganization) => {
          const dbOrg = dbData.organizations.find((o: DBOrganization) => o.external_id === workosOrg.id)
          if (!dbOrg?.slug) return null
          return {
            id: workosOrg.id,
            name: workosOrg.name,
            slug: dbOrg.slug
          }
        })
        .filter((org: Organization | null): org is Organization => org !== null)
      
      return { organizations }
    },
  })

  // Fetch agents for the selected organization
  const { data: agentsData } = useQuery<{ agents: Agent[] }>({
    queryKey: ['admin-agents', organizationSlug],
    queryFn: async () => {
      if (organizationSlug === 'all') {
        return { agents: [] }
      }
      const response = await fetch(`/api/${organizationSlug}/agents`)
      if (!response.ok) {
        throw new Error('Failed to fetch agents')
      }
      return response.json()
    },
    enabled: organizationSlug !== 'all',
  })

  // Fetch calls with React Query
  const { data, isLoading, isRefetching, refetch } = useQuery<CallsResponse>({
    queryKey: ['admin-calls', currentPage, limit, organizationSlug, agentId, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
      })
      
      // Add filters
      if (organizationSlug && organizationSlug !== 'all') params.append('slug', organizationSlug)
      if (agentId && agentId !== 'all') params.append('agent_id', agentId)
      if (dateRange?.from) params.append('date_from', dateRange.from.toISOString().split('T')[0])
      if (dateRange?.to) params.append('date_to', dateRange.to.toISOString().split('T')[0])

      const response = await fetch(`/api/admin/calls?${params.toString()}`)
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
    setOrganizationSlug('all')
    setAgentId('all')
    setDateRange(undefined)
  }

  const handleLimitChange = (value: string) => {
    setLimit(parseInt(value))
  }

  // Reset agent filter when organization changes
  useEffect(() => {
    setAgentId('all')
  }, [organizationSlug])

  const hasActiveFilters = 
    (organizationSlug && organizationSlug !== 'all') || 
    (agentId && agentId !== 'all') || 
    dateRange !== undefined

  const calls = data?.calls || []
  const pagination = data?.pagination
  const organizations = organizationsData?.organizations || []
  const agents = agentsData?.agents || []

  return (
    <div className="px-4 lg:px-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">All Calls</h1>
            <p className="text-muted-foreground">
              View and manage calls across all organizations
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
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="client-filter">Client</Label>
              <Select value={organizationSlug} onValueChange={setOrganizationSlug}>
                <SelectTrigger id="client-filter">
                  <SelectValue placeholder="All clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All clients</SelectItem>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.slug}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="agent-filter">Agent</Label>
              <Select 
                value={agentId} 
                onValueChange={setAgentId}
                disabled={organizationSlug === 'all'}
              >
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
            <CallsTable 
              calls={calls} 
              slug="admin" 
              showEvents={true} 
              showCosts={true} 
              showTimeline={true} 
              showLatency={true}
              showOrganization={true}
            />
            
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

