'use client'

import { useState, useEffect, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { IconLoader2, IconTrash, IconFile, IconLink, IconFileText, IconDatabase, IconExternalLink, IconRefresh, IconChevronLeft, IconChevronRight, IconBuilding, IconHome, IconSparkles } from "@tabler/icons-react"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AddItemDialog } from './AddItemDialog'
import { toast } from "sonner"

interface KnowledgeBaseItem {
  id: string
  name: string
  type: string
  status: string
  url?: string
  text_content?: string
  file_location?: string
  parent_item_id?: string | null
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
  sync_error?: string | null
  extracted_keywords?: string[] | null
  keyword_extraction_status?: 'pending' | 'processing' | 'completed' | 'failed' | null
}


type KnowledgeBase = {
  id: string
  name: string
  description?: string | null
  created_at: string
  updated_at: string
}

interface KnowledgeBaseItemsTableProps {
  slug: string
  knowledgeBaseId: string
}

export function KnowledgeBaseItemsTable({ slug, knowledgeBaseId }: KnowledgeBaseItemsTableProps) {
  const router = useRouter()
  const [itemToDelete, setItemToDelete] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [pageSize, setPageSize] = useState<number>(50)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [resyncingItems, setResyncingItems] = useState<Set<string>>(new Set())
  const queryClient = useQueryClient()

  const handleEstateAgentClick = (itemId: string) => {
    router.push(`/${slug}/knowledge-base/${knowledgeBaseId}/estate-agent/${itemId}`)
  }

  // Fetch knowledge base details
  const { data: knowledgeBase, isLoading: isLoadingKB } = useQuery<KnowledgeBase | undefined>({
    queryKey: ['knowledge-base', slug, knowledgeBaseId],
    queryFn: async () => {
      const response = await fetch(`/api/${slug}/knowledge-bases/${knowledgeBaseId}`)
      if (!response.ok) return undefined
      const data = await response.json()
      return data.knowledgeBase as KnowledgeBase
    },
  })

  // Fetch knowledge base items
  const { data: items = [], isLoading: isLoadingItems } = useQuery({
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
      const items = query.state.data as KnowledgeBaseItem[] || []
      const hasProcessingItems = items.some(
        item => item.status === 'pending' || item.status === 'processing'
      )
      const hasProcessingKeywords = items.some(
        item => item.keyword_extraction_status === 'pending' || item.keyword_extraction_status === 'processing'
      )
      // Refetch every 5 seconds if there are processing items or keyword extractions
      return (hasProcessingItems || hasProcessingKeywords) ? 5000 : false
    },
  })

  const handleItemAdded = () => {
    queryClient.invalidateQueries({ queryKey: ['knowledge-base-items', slug, knowledgeBaseId] })
  }

  // Delete mutation with optimistic updates
  const deleteMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const response = await fetch(
        `/api/${slug}/knowledge-bases/${knowledgeBaseId}/items/${itemId}`,
        { method: 'DELETE' }
      )
      if (!response.ok) {
        throw new Error('Failed to delete item')
      }
      return itemId
    },
    onMutate: async (itemId: string) => {
      // Cancel any outgoing refetches to avoid overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: ['knowledge-base-items', slug, knowledgeBaseId] })

      // Snapshot the previous value
      const previousItems = queryClient.getQueryData(['knowledge-base-items', slug, knowledgeBaseId])

      // Optimistically update the cache by removing the item
      queryClient.setQueryData(
        ['knowledge-base-items', slug, knowledgeBaseId],
        (old: KnowledgeBaseItem[] | undefined) => {
          if (!old) return []
          return old.filter((item) => item.id !== itemId)
        }
      )

      // Return a context object with the snapshotted value
      return { previousItems }
    },
    onSuccess: () => {
      toast.success('Item deleted successfully')
      setItemToDelete(null)
    },
    onError: (error, itemId, context) => {
      // Revert the optimistic update on error
      if (context?.previousItems) {
        queryClient.setQueryData(
          ['knowledge-base-items', slug, knowledgeBaseId],
          context.previousItems
        )
      }
      console.error('Error deleting item:', error)
      toast.error('Failed to delete item')
    },
    onSettled: () => {
      // Always refetch after error or success to ensure we have the latest data
      queryClient.invalidateQueries({ queryKey: ['knowledge-base-items', slug, knowledgeBaseId] })
    },
  })

  const handleDelete = () => {
    if (!itemToDelete) return
    deleteMutation.mutate(itemToDelete)
  }

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (itemIds: string[]) => {
      // Delete all items in parallel
      const deletePromises = itemIds.map(itemId =>
        fetch(`/api/${slug}/knowledge-bases/${knowledgeBaseId}/items/${itemId}`, {
          method: 'DELETE'
        }).then(res => {
          if (!res.ok) throw new Error(`Failed to delete item ${itemId}`)
          return itemId
        })
      )
      return Promise.all(deletePromises)
    },
    onMutate: async (itemIds: string[]) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['knowledge-base-items', slug, knowledgeBaseId] })

      // Snapshot the previous value
      const previousItems = queryClient.getQueryData(['knowledge-base-items', slug, knowledgeBaseId])

      // Optimistically update the cache by removing the items
      queryClient.setQueryData(
        ['knowledge-base-items', slug, knowledgeBaseId],
        (old: KnowledgeBaseItem[] | undefined) => {
          if (!old) return []
          return old.filter((item) => !itemIds.includes(item.id))
        }
      )

      // Return a context object with the snapshotted value
      return { previousItems }
    },
    onSuccess: (deletedIds) => {
      const count = deletedIds.length
      toast.success(`${count} item${count !== 1 ? 's' : ''} deleted successfully`)
      clearSelection()
      setItemToDelete(null)
    },
    onError: (error, itemIds, context) => {
      // Revert the optimistic update on error
      if (context?.previousItems) {
        queryClient.setQueryData(
          ['knowledge-base-items', slug, knowledgeBaseId],
          context.previousItems
        )
      }
      console.error('Error deleting items:', error)
      toast.error('Failed to delete items')
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['knowledge-base-items', slug, knowledgeBaseId] })
    },
  })

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return
    bulkDeleteMutation.mutate(Array.from(selectedIds))
  }

  // Retry mutation for failed items
  const retryMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const response = await fetch(
        `/api/${slug}/knowledge-bases/${knowledgeBaseId}/items/${itemId}/retry`,
        { method: 'POST' }
      )
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to retry item')
      }
      return response.json()
    },
    onSuccess: () => {
      toast.success('Item queued for reprocessing')
      queryClient.invalidateQueries({ queryKey: ['knowledge-base-items', slug, knowledgeBaseId] })
    },
    onError: (error) => {
      console.error('Error retrying item:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to retry item')
    },
  })

  // Bulk retry mutation for all failed items
  const bulkRetryMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/${slug}/knowledge-bases/${knowledgeBaseId}/items/bulk-retry`,
        { method: 'POST' }
      )
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to retry items')
      }
      return response.json()
    },
    onSuccess: (data) => {
      const count = data.retried || 0
      toast.success(`${count} failed item${count !== 1 ? 's' : ''} queued for reprocessing`)
      queryClient.invalidateQueries({ queryKey: ['knowledge-base-items', slug, knowledgeBaseId] })
    },
    onError: (error) => {
      console.error('Error retrying items:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to retry items')
    },
  })

  // Re-sync mutation for rightmove_agent items
  const resyncMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const response = await fetch(
        `/api/${slug}/knowledge-bases/${knowledgeBaseId}/items/${itemId}/retry`,
        { method: 'POST' }
      )
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to re-sync agent')
      }
      return response.json()
    },
    onMutate: async (itemId: string) => {
      setResyncingItems(prev => new Set(prev).add(itemId))
    },
    onSuccess: (_, itemId) => {
      toast.success('Agent queued for re-sync. Properties will be refreshed.')
      setResyncingItems(prev => {
        const next = new Set(prev)
        next.delete(itemId)
        return next
      })
      queryClient.invalidateQueries({ queryKey: ['knowledge-base-items', slug, knowledgeBaseId] })
    },
    onError: (error, itemId) => {
      console.error('Error re-syncing agent:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to re-sync agent')
      setResyncingItems(prev => {
        const next = new Set(prev)
        next.delete(itemId)
        return next
      })
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

  // Only show parent items (items without parent_item_id)
  // This excludes child properties which are shown on the estate agent detail page
  const parentItems = useMemo(() => {
    return items.filter((i: KnowledgeBaseItem) => !i.parent_item_id)
  }, [items])

  // Count children for each parent
  const childrenCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    items.forEach((item: KnowledgeBaseItem) => {
      if (item.parent_item_id) {
        counts[item.parent_item_id] = (counts[item.parent_item_id] || 0) + 1
      }
    })
    return counts
  }, [items])

  // Selection helper functions
  const toggleItem = (itemId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }

  const toggleAll = () => {
    if (selectedIds.size === paginatedItems.length) {
      // Deselect all
      setSelectedIds(new Set())
    } else {
      // Select all on current page
      setSelectedIds(new Set(paginatedItems.map((item: KnowledgeBaseItem) => item.id)))
    }
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
  }

  // Check if an item has been processing for too long (>5 minutes)
  const isStuckProcessing = (item: KnowledgeBaseItem): boolean => {
    if (item.status !== 'processing') return false
    const updatedAt = new Date(item.updated_at)
    const now = new Date()
    const diffMinutes = (now.getTime() - updatedAt.getTime()) / 1000 / 60
    return diffMinutes > 5
  }

  // Mark stuck items as failed
  useEffect(() => {
    if (!items || items.length === 0) return
    
    const stuckItems = items.filter((item: KnowledgeBaseItem) => isStuckProcessing(item))
    
    if (stuckItems.length > 0) {
      // Mark these items as failed
      stuckItems.forEach((item: KnowledgeBaseItem) => {
        fetch(`/api/${slug}/knowledge-bases/${knowledgeBaseId}/items/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            status: 'failed',
            sync_error: 'Processing timed out after 5 minutes'
          })
        }).catch(err => console.error('Error marking item as failed:', err))
      })
      
      // Refresh the list after a short delay
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['knowledge-base-items', slug, knowledgeBaseId] })
      }, 1000)
    }
  }, [items, slug, knowledgeBaseId, queryClient])

  // Truncate long text for display
  const truncateText = (text: string, maxLength: number = 60): string => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  // Filter items
  const filteredItems = useMemo(() => {
    if (!items || items.length === 0) return []
    
    let filtered = parentItems
    
    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter((item: KnowledgeBaseItem) => item.type === typeFilter)
    }
    
    // Apply status filter  
    if (statusFilter !== 'all') {
      filtered = filtered.filter((item: KnowledgeBaseItem) => item.status === statusFilter)
    }
    
    return filtered
  }, [parentItems, typeFilter, statusFilter])

  // Paginated items
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return filteredItems.slice(startIndex, endIndex)
  }, [filteredItems, currentPage, pageSize])

  // Total pages
  const totalPages = Math.ceil(filteredItems.length / pageSize)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [typeFilter, statusFilter, pageSize])

  // Clear selection when filters or page changes
  useEffect(() => {
    clearSelection()
  }, [typeFilter, statusFilter, currentPage, pageSize])

  // Count failed items for bulk retry button
  const failedCount = useMemo(() => {
    return items.filter((item: KnowledgeBaseItem) => item.status === 'failed').length
  }, [items])

  // Count items pending keyword extraction
  // Exclude rightmove_agent items as they have no direct content
  const pendingKeywordCount = useMemo(() => {
    return items.filter((item: KnowledgeBaseItem) => 
      item.type !== 'rightmove_agent' &&
      (!item.keyword_extraction_status || item.keyword_extraction_status === 'failed')
    ).length
  }, [items])

  // Check if any items are processing keyword extraction
  const isAnyProcessingKeywords = useMemo(() => {
    return items.some((item: KnowledgeBaseItem) => 
      item.type !== 'rightmove_agent' &&
      (item.keyword_extraction_status === 'pending' || 
       item.keyword_extraction_status === 'processing')
    )
  }, [items])

  // Check if all items on current page are selected
  const allSelected = paginatedItems.length > 0 && selectedIds.size === paginatedItems.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < paginatedItems.length


  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'indexed':
        return (
          <Badge variant="default" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
            Indexed
          </Badge>
        )
      case 'processing':
        return (
          <Badge variant="default" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20">
            <IconLoader2 className="h-3 w-3 mr-1 animate-spin" />
            Processing
          </Badge>
        )
      case 'pending':
        return (
          <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20">
            Pending
          </Badge>
        )
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'file':
        return <IconFile className="h-4 w-4 text-muted-foreground" />
      case 'url':
        return <IconLink className="h-4 w-4 text-muted-foreground" />
      case 'text':
        return <IconFileText className="h-4 w-4 text-muted-foreground" />
      case 'rightmove_agent':
        return <IconBuilding className="h-4 w-4 text-purple-600" />
      case 'rightmove_property':
        return <IconHome className="h-4 w-4 text-blue-600" />
      default:
        return null
    }
  }


  return (
    <div className="space-y-6">

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-xl">
            {isLoadingKB ? (
              <Skeleton className="h-6 w-56" />
            ) : (
              knowledgeBase?.name ?? 'Knowledge Base'
            )}
          </CardTitle>
          <CardDescription>
            {isLoadingKB
              ? null
              : knowledgeBase?.description || 'Add and manage documents for this knowledge base.'}
          </CardDescription>
          <CardAction>
            <div className="flex gap-2">
              {selectedIds.size > 0 && (
                <Button
                  variant="destructive"
                  onClick={() => setItemToDelete('bulk')}
                  disabled={bulkDeleteMutation.isPending}
                >
                  <IconTrash className="mr-2 h-4 w-4" />
                  Delete Selected ({selectedIds.size})
                </Button>
              )}
              {failedCount > 0 && (
                <Button
                  variant="outline"
                  onClick={() => bulkRetryMutation.mutate()}
                  disabled={bulkRetryMutation.isPending}
                >
                  <IconRefresh className="mr-2 h-4 w-4" />
                  Retry All Failed ({failedCount})
                </Button>
              )}
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
              <AddItemDialog 
                slug={slug} 
                knowledgeBaseId={knowledgeBaseId} 
                onItemAdded={handleItemAdded}
              />
            </div>
          </CardAction>
        </CardHeader>
        <CardContent>
          {isLoadingItems ? (
            <div className="flex items-center justify-center py-12">
              <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <IconDatabase />
                </EmptyMedia>
                <EmptyTitle>No Items Yet</EmptyTitle>
                <EmptyDescription>
                  This knowledge base is empty. Add files, URLs, or text content to get started.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              {/* Filters and Controls */}
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-4 flex-wrap">
                  {/* Type Filter */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Type:</span>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="url">URL</SelectItem>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="file">File</SelectItem>
                        <SelectItem value="rightmove_agent">Property Agent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Status Filter */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[130px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="indexed">Indexed</SelectItem>
                        <SelectItem value="processing">Processing</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Page Size Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Show:</span>
                  <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Results Info */}
              <div className="text-sm text-muted-foreground mb-4">
                Showing {filteredItems.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
                {Math.min(currentPage * pageSize, filteredItems.length)} of {filteredItems.length} item
                {filteredItems.length !== 1 ? 's' : ''}
                {(typeFilter !== 'all' || statusFilter !== 'all') && ` (filtered from ${items.length} total)`}
              </div>

              {filteredItems.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <IconDatabase />
                    </EmptyMedia>
                    <EmptyTitle>No Matching Items</EmptyTitle>
                    <EmptyDescription>
                      No items match your current filters. Try adjusting your filter settings.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={toggleAll}
                        aria-label="Select all"
                        className={someSelected ? "data-[state=checked]:bg-primary" : ""}
                      />
                    </TableHead>
                    <TableHead className="w-[35%]">Name</TableHead>
                    <TableHead className="w-[12%]">Type</TableHead>
                    <TableHead className="w-[18%]">Status</TableHead>
                    <TableHead className="w-[10%]">Properties</TableHead>
                    <TableHead className="w-[13%]">Created</TableHead>
                    <TableHead className="w-[10%] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((item: KnowledgeBaseItem) => {
                    const isFailed = item.status === 'failed'
                    const displayName = truncateText(item.name, 60)
                    const displayUrl = item.url ? truncateText(item.url, 50) : null
                    const isEstateAgent = item.type === 'rightmove_agent'
                    const propertyCount = childrenCounts[item.id] || 0
                    
                    return (
                      <TableRow 
                        key={item.id} 
                        className={`group ${isEstateAgent ? 'cursor-pointer hover:bg-muted/50' : ''}`}
                        onClick={() => isEstateAgent && handleEstateAgentClick(item.id)}
                      >

                        {/* Checkbox Column */}
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(item.id)}
                            onCheckedChange={() => toggleItem(item.id)}
                            aria-label={`Select ${item.name}`}
                            disabled={deleteMutation.isPending || bulkDeleteMutation.isPending}
                          />
                        </TableCell>

                        {/* Name Column */}
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0">
                              {getTypeIcon(item.type)}
                            </div>
                            <div className="flex flex-col min-w-0 max-w-full">
                              <div className="flex items-center gap-2">
                                <TooltipProvider delayDuration={300}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="text-sm font-medium">
                                        {displayName}
                                      </span>
                                    </TooltipTrigger>
                                    {item.name.length > 60 && (
                                      <TooltipContent side="top" className="max-w-md">
                                        <p className="break-words">{item.name}</p>
                                      </TooltipContent>
                                    )}
                                  </Tooltip>
                                </TooltipProvider>
                                {item.type === 'rightmove_agent' && (
                                  <Badge variant="outline" className="border-purple-500 text-purple-700 text-xs">
                                    Estate Agent
                                  </Badge>
                                )}
                              </div>
                              {item.url && (
                                <TooltipProvider delayDuration={300}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <a
                                        href={item.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mt-0.5 max-w-full"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <span className="truncate">{displayUrl}</span>
                                        <IconExternalLink className="h-3 w-3 flex-shrink-0" />
                                      </a>
                                    </TooltipTrigger>
                                    {item.url && item.url.length > 50 && (
                                      <TooltipContent side="top" className="max-w-md">
                                        <p className="break-all">{item.url}</p>
                                      </TooltipContent>
                                    )}
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* Type Column */}
                        <TableCell>
                          <Badge variant={item.type === 'rightmove_property' ? 'secondary' : 'outline'} className="capitalize text-xs">
                            {item.type === 'rightmove_agent' ? 'Property Agent' : 
                             item.type === 'rightmove_property' ? 'Property' : 
                             item.type}
                          </Badge>
                        </TableCell>

                        {/* Status Column */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(item.status)}
                            {isFailed && item.sync_error && (
                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-xs text-muted-foreground cursor-help">ⓘ</span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-sm">
                                    <p className="text-xs">{item.sync_error}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </TableCell>

                        {/* Properties Column */}
                        <TableCell className="text-sm text-muted-foreground">
                          {isEstateAgent ? (
                            <span className="font-medium">{propertyCount}</span>
                          ) : (
                            <span>-</span>
                          )}
                        </TableCell>

                        {/* Created Column */}
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(item.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </TableCell>

                        {/* Actions Column */}
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {item.type === 'rightmove_agent' && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  resyncMutation.mutate(item.id)
                                }}
                                disabled={resyncingItems.has(item.id)}
                                title="Re-sync properties"
                              >
                                <IconRefresh className={`h-4 w-4 ${resyncingItems.has(item.id) ? 'animate-spin' : ''}`} />
                              </Button>
                            )}
                            {isFailed && !isEstateAgent && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  retryMutation.mutate(item.id)
                                }}
                                disabled={retryMutation.isPending}
                                title="Retry processing"
                              >
                                <IconRefresh className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation()
                                setItemToDelete(item.id)
                              }}
                            >
                              <IconTrash className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
              )}

              {/* Pagination Controls */}
              {filteredItems.length > 0 && totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <IconChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <IconChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {itemToDelete === 'bulk' 
                ? `This will permanently delete ${selectedIds.size} item${selectedIds.size !== 1 ? 's' : ''} from your knowledge base. This action cannot be undone.`
                : (() => {
                    const item = parentItems.find((i: KnowledgeBaseItem) => i.id === itemToDelete)
                    const childCount = childrenCounts[itemToDelete || ''] || 0
                    if (childCount > 0) {
                      return `This will permanently delete this estate agent and all ${childCount} propert${childCount !== 1 ? 'ies' : 'y'} from your knowledge base. This action cannot be undone.`
                    }
                    return 'This will permanently delete this item from your knowledge base. This action cannot be undone.'
                  })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending || bulkDeleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={itemToDelete === 'bulk' ? handleBulkDelete : handleDelete}
              disabled={deleteMutation.isPending || bulkDeleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {(deleteMutation.isPending || bulkDeleteMutation.isPending) ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

