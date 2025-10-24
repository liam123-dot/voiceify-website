'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { IconLoader2, IconCheck, IconX, IconClock, IconPlus, IconChevronDown, IconChevronRight } from '@tabler/icons-react'
import type { CustomExtraction, ExtractionModel } from '@/types/extractions'
import { NewExtractionForm } from './NewExtractionForm'
import { ExtractionResults } from './ExtractionResults'

interface CustomExtractionsProps {
  slug: string
  knowledgeBaseId: string
  estateAgentId: string
  propertyCount: number
}

export function CustomExtractions({
  slug,
  knowledgeBaseId,
  estateAgentId,
  propertyCount,
}: CustomExtractionsProps) {
  const queryClient = useQueryClient()
  const [newFormOpen, setNewFormOpen] = useState(false)
  const [expandedExtraction, setExpandedExtraction] = useState<string | null>(null)

  // Fetch all extractions
  const { data: extractions = [], isLoading } = useQuery({
    queryKey: ['extractions', slug, knowledgeBaseId],
    queryFn: async () => {
      const response = await fetch(`/api/${slug}/knowledge-bases/${knowledgeBaseId}/extractions`)
      if (!response.ok) {
        throw new Error('Failed to fetch extractions')
      }
      const data = await response.json()
      return data.extractions as CustomExtraction[]
    },
    refetchInterval: (query) => {
      // Refetch every 3 seconds if there are processing extractions
      const extractions = (query.state.data as CustomExtraction[]) || []
      const hasProcessing = extractions.some((e) => e.status === 'processing' || e.status === 'pending')
      return hasProcessing ? 3000 : false
    },
  })

  // Filter to only show extractions for this estate agent
  const estateAgentExtractions = useMemo(() => {
    return extractions.filter((e) => e.parent_item_id === estateAgentId)
  }, [extractions, estateAgentId])

  // Create extraction mutation
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; prompt: string; model: string }): Promise<{ extraction: CustomExtraction }> => {
      const response = await fetch(`/api/${slug}/knowledge-bases/${knowledgeBaseId}/extractions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          parentItemId: estateAgentId,
        }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create extraction')
      }
      return response.json()
    },
    onSuccess: (data) => {
      toast.success(`Started extraction for ${data.extraction.total_items} properties`)
      queryClient.invalidateQueries({ queryKey: ['extractions', slug, knowledgeBaseId] })
      setNewFormOpen(false)
      // Expand the new extraction
      setExpandedExtraction(data.extraction.id)
    },
    onError: (error) => {
      console.error('Error creating extraction:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create extraction')
    },
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <IconCheck className="h-4 w-4" />
      case 'failed':
        return <IconX className="h-4 w-4" />
      case 'processing':
        return <IconLoader2 className="h-4 w-4 animate-spin" />
      case 'pending':
        return <IconClock className="h-4 w-4" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20'
      case 'failed':
        return 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20'
      case 'processing':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20'
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20'
      default:
        return ''
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
    return date.toLocaleDateString()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* New Extraction Form */}
      <Collapsible open={newFormOpen} onOpenChange={setNewFormOpen}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">
            Run custom AI prompts to extract structured data from all {propertyCount} properties
          </h3>
          <CollapsibleTrigger asChild>
            <Button>
              <IconPlus className="h-4 w-4 mr-2" />
              New Extraction
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="mt-6">
          <div className="rounded-lg border p-6 bg-muted/50">
            <NewExtractionForm
              propertyCount={propertyCount}
              onSubmit={(data: { name: string; prompt: string; model: ExtractionModel }) => createMutation.mutate(data)}
              isSubmitting={createMutation.isPending}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Extractions List */}
      {estateAgentExtractions.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          <p>No extractions yet</p>
          <p className="mt-1">Click &quot;New Extraction&quot; to get started</p>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Past Extractions</h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {estateAgentExtractions.map((extraction) => (
                  <>
                    <TableRow
                      key={extraction.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() =>
                        setExpandedExtraction(
                          expandedExtraction === extraction.id ? null : extraction.id
                        )
                      }
                    >
                      <TableCell>
                        {expandedExtraction === extraction.id ? (
                          <IconChevronDown className="h-4 w-4" />
                        ) : (
                          <IconChevronRight className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{extraction.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {extraction.model.split('/')[1]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`gap-1 ${getStatusColor(extraction.status)}`}
                        >
                          {getStatusIcon(extraction.status)}
                          <span className="capitalize">{extraction.status}</span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {extraction.processed_items + extraction.failed_items}/{extraction.total_items}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(extraction.created_at)}
                        </span>
                      </TableCell>
                    </TableRow>
                    {expandedExtraction === extraction.id && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-muted/30 p-6">
                          <ExtractionResults
                            slug={slug}
                            knowledgeBaseId={knowledgeBaseId}
                            extraction={extraction}
                            onDelete={() => {
                              setExpandedExtraction(null)
                              queryClient.invalidateQueries({
                                queryKey: ['extractions', slug, knowledgeBaseId],
                              })
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
