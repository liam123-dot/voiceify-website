'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { IconLoader2, IconRefresh, IconSparkles, IconMapPin, IconArrowLeft } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { EstateAgentEditForm } from './EstateAgentEditForm'
import { EstateAgentPropertiesTable } from './EstateAgentPropertiesTable'
import { EstateAgentLocationsModal } from './EstateAgentLocationsModal'
import { CustomExtractions } from './CustomExtractions'
import type { KnowledgeBaseItem, RightmoveAgentConfig } from '@/types/knowledge-base'
import Link from 'next/link'

interface EstateAgentDetailProps {
  slug: string
  knowledgeBaseId: string
  estateAgentId: string
}

export function EstateAgentDetail({ slug, knowledgeBaseId, estateAgentId }: EstateAgentDetailProps) {
  const queryClient = useQueryClient()
  const [locationsModalOpen, setLocationsModalOpen] = useState(false)

  // Fetch all knowledge base items
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['knowledge-base-items', slug, knowledgeBaseId],
    queryFn: async () => {
      const response = await fetch(`/api/${slug}/knowledge-bases/${knowledgeBaseId}/items`)
      if (!response.ok) {
        throw new Error('Failed to fetch items')
      }
      const data = await response.json()
      return data.items || []
    },
    refetchInterval: (query) => {
      // Check if any items are in non-final state
      const items = (query.state.data as KnowledgeBaseItem[]) || []
      const hasProcessingItems = items.some(
        (item) => item.status === 'pending' || item.status === 'processing'
      )
      const hasProcessingKeywords = items.some(
        (item) =>
          item.keyword_extraction_status === 'pending' ||
          item.keyword_extraction_status === 'processing'
      )
      // Refetch every 5 seconds if there are processing items or keyword extractions
      return hasProcessingItems || hasProcessingKeywords ? 5000 : false
    },
  })

  // Find the estate agent item
  const estateAgent = useMemo(() => {
    return items.find((item: KnowledgeBaseItem) => item.id === estateAgentId)
  }, [items, estateAgentId])

  // Find all child properties
  const properties = useMemo(() => {
    return items.filter((item: KnowledgeBaseItem) => item.parent_item_id === estateAgentId)
  }, [items, estateAgentId])

  // Count properties pending keyword extraction
  const pendingKeywordCount = useMemo(() => {
    return properties.filter(
      (item: KnowledgeBaseItem) =>
        !item.keyword_extraction_status || item.keyword_extraction_status === 'failed'
    ).length
  }, [properties])

  // Check if any properties are processing keyword extraction
  const isAnyProcessingKeywords = useMemo(() => {
    return properties.some(
      (item: KnowledgeBaseItem) =>
        item.keyword_extraction_status === 'pending' ||
        item.keyword_extraction_status === 'processing'
    )
  }, [properties])

  // Count properties by status
  const statusCounts = useMemo(() => {
    const counts = { indexed: 0, processing: 0, pending: 0, failed: 0 }
    properties.forEach((prop: KnowledgeBaseItem) => {
      if (prop.status in counts) {
        counts[prop.status as keyof typeof counts]++
      }
    })
    return counts
  }, [properties])

  // Re-sync mutation
  const resyncMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/${slug}/knowledge-bases/${knowledgeBaseId}/items/${estateAgentId}/retry`,
        { method: 'POST' }
      )
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to re-sync estate agent')
      }
      return response.json()
    },
    onSuccess: () => {
      toast.success('Estate agent queued for re-sync. Properties will be refreshed.')
      queryClient.invalidateQueries({ queryKey: ['knowledge-base-items', slug, knowledgeBaseId] })
    },
    onError: (error) => {
      console.error('Error re-syncing estate agent:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to re-sync estate agent')
    },
  })

  // Extract keywords mutation
  const extractKeywordsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/${slug}/knowledge-bases/${knowledgeBaseId}/extract-keywords`,
        { method: 'POST' }
      )
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to extract keywords')
      }
      return response.json()
    },
    onSuccess: (data) => {
      toast.success(data.message || `Queued ${data.queued} item(s) for keyword extraction`)
      queryClient.invalidateQueries({ queryKey: ['knowledge-base-items', slug, knowledgeBaseId] })
    },
    onError: (error) => {
      console.error('Error extracting keywords:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to extract keywords')
    },
  })

  const handleRefetchItems = () => {
    queryClient.invalidateQueries({ queryKey: ['knowledge-base-items', slug, knowledgeBaseId] })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!estateAgent) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <p className="text-lg font-semibold">Estate agent not found</p>
              <p className="text-sm text-muted-foreground mt-2">
                The estate agent you are looking for does not exist or has been deleted.
              </p>
              <Link href={`/${slug}/knowledge-base/${knowledgeBaseId}`} className="mt-4 inline-block">
                <Button variant="outline">
                  <IconArrowLeft className="mr-2 h-4 w-4" />
                  Back to Knowledge Base
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const metadata = estateAgent.metadata as RightmoveAgentConfig | undefined

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Properties</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{properties.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Indexed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{statusCounts.indexed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Processing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{statusCounts.processing}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{statusCounts.failed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>Manage properties and extract data from this estate agent</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => resyncMutation.mutate()}
              disabled={resyncMutation.isPending}
            >
              {resyncMutation.isPending ? (
                <>
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                  Re-syncing...
                </>
              ) : (
                <>
                  <IconRefresh className="mr-2 h-4 w-4" />
                  Re-sync Properties
                </>
              )}
            </Button>
            {(pendingKeywordCount > 0 || isAnyProcessingKeywords) && (
              <Button
                variant="outline"
                onClick={() => extractKeywordsMutation.mutate()}
                disabled={extractKeywordsMutation.isPending || isAnyProcessingKeywords}
              >
                {isAnyProcessingKeywords ? (
                  <>
                    <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <IconSparkles className="mr-2 h-4 w-4" />
                    Extract Keywords {pendingKeywordCount > 0 && `(${pendingKeywordCount})`}
                  </>
                )}
              </Button>
            )}
            <Button variant="outline" onClick={() => setLocationsModalOpen(true)}>
              <IconMapPin className="mr-2 h-4 w-4" />
              View Locations
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Edit Form */}
      <EstateAgentEditForm
        slug={slug}
        knowledgeBaseId={knowledgeBaseId}
        estateAgentId={estateAgentId}
        initialData={{
          name: estateAgent.name,
          metadata,
        }}
        onSuccess={handleRefetchItems}
      />

      {/* Main Content Tabs */}
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="properties">
            <TabsList className="mb-6">
              <TabsTrigger value="properties">Properties ({properties.length})</TabsTrigger>
              <TabsTrigger value="extractions">Custom Extractions</TabsTrigger>
            </TabsList>

            <TabsContent value="properties">
              <EstateAgentPropertiesTable
                slug={slug}
                knowledgeBaseId={knowledgeBaseId}
                properties={properties}
              />
            </TabsContent>

            <TabsContent value="extractions">
              <CustomExtractions
                slug={slug}
                knowledgeBaseId={knowledgeBaseId}
                estateAgentId={estateAgentId}
                propertyCount={properties.length}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Locations Modal */}
      <EstateAgentLocationsModal
        open={locationsModalOpen}
        onOpenChange={setLocationsModalOpen}
        properties={properties}
      />
    </div>
  )
}

