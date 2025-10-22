'use client'

import { useState, useEffect, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { IconLoader2, IconTrash, IconFile, IconLink, IconFileText, IconDatabase, IconExternalLink, IconRefresh, IconChevronLeft, IconChevronRight } from "@tabler/icons-react"
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
  created_at: string
  updated_at: string
  sync_error?: string | null
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
  const [itemToDelete, setItemToDelete] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [pageSize, setPageSize] = useState<number>(50)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const queryClient = useQueryClient()

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
      // Refetch every 5 seconds if there are processing items
      return hasProcessingItems ? 5000 : false
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

  // Filter and paginate items
  const filteredItems = useMemo(() => {
    if (!items || items.length === 0) return []
    
    let filtered = [...items] as KnowledgeBaseItem[]
    
    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(item => item.type === typeFilter)
    }
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => item.status === statusFilter)
    }
    
    return filtered
  }, [items, typeFilter, statusFilter])

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

  // Count failed items for bulk retry button
  const failedCount = useMemo(() => {
    return items.filter((item: KnowledgeBaseItem) => item.status === 'failed').length
  }, [items])


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
                <div className="flex items-center gap-4">
                  {/* Type Filter */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Type:</span>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="url">URL</SelectItem>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="file">File</SelectItem>
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
                    <TableHead className="w-[40%]">Name</TableHead>
                    <TableHead className="w-[15%]">Type</TableHead>
                    <TableHead className="w-[20%]">Status</TableHead>
                    <TableHead className="w-[15%]">Created</TableHead>
                    <TableHead className="w-[10%] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((item: KnowledgeBaseItem) => {
                    const isFailed = item.status === 'failed'
                    const displayName = truncateText(item.name, 60)
                    const displayUrl = item.url ? truncateText(item.url, 50) : null
                    
                    return (
                      <TableRow key={item.id} className="group">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0">
                              {getTypeIcon(item.type)}
                            </div>
                            <div className="flex flex-col min-w-0 max-w-full">
                              <TooltipProvider delayDuration={300}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-sm font-medium cursor-default">
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
                        <TableCell>
                          <Badge variant="outline" className="capitalize text-xs">
                            {item.type}
                          </Badge>
                        </TableCell>
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
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(item.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isFailed && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => retryMutation.mutate(item.id)}
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
                              onClick={() => setItemToDelete(item.id)}
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
              This will permanently delete this item from your knowledge base and remove it from Ragie.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

