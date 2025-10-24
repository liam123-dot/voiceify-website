'use client'

import { useState, useMemo, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  IconLoader2,
  IconTrash,
  IconRefresh,
  IconExternalLink,
  IconChevronLeft,
  IconChevronRight,
  IconBed,
  IconBath,
} from '@tabler/icons-react'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { IconDatabase } from '@tabler/icons-react'
import { toast } from 'sonner'
import type { KnowledgeBaseItem, RightmovePropertyMetadata } from '@/types/knowledge-base'
import Image from 'next/image'

interface EstateAgentPropertiesTableProps {
  slug: string
  knowledgeBaseId: string
  properties: KnowledgeBaseItem[]
}

export function EstateAgentPropertiesTable({
  slug,
  knowledgeBaseId,
  properties,
}: EstateAgentPropertiesTableProps) {
  const queryClient = useQueryClient()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [itemToDelete, setItemToDelete] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [pageSize, setPageSize] = useState<number>(50)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [sortBy, setSortBy] = useState<'price' | 'beds' | 'date'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const response = await fetch(
        `/api/${slug}/knowledge-bases/${knowledgeBaseId}/items/${itemId}`,
        { method: 'DELETE' }
      )
      if (!response.ok) {
        throw new Error('Failed to delete property')
      }
      return itemId
    },
    onSuccess: () => {
      toast.success('Property deleted successfully')
      setItemToDelete(null)
      queryClient.invalidateQueries({ queryKey: ['knowledge-base-items', slug, knowledgeBaseId] })
    },
    onError: (error) => {
      console.error('Error deleting property:', error)
      toast.error('Failed to delete property')
    },
  })

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (itemIds: string[]) => {
      const deletePromises = itemIds.map((itemId) =>
        fetch(`/api/${slug}/knowledge-bases/${knowledgeBaseId}/items/${itemId}`, {
          method: 'DELETE',
        }).then((res) => {
          if (!res.ok) throw new Error(`Failed to delete property ${itemId}`)
          return itemId
        })
      )
      return Promise.all(deletePromises)
    },
    onSuccess: (deletedIds) => {
      const count = deletedIds.length
      toast.success(`${count} propert${count !== 1 ? 'ies' : 'y'} deleted successfully`)
      setSelectedIds(new Set())
      setItemToDelete(null)
      queryClient.invalidateQueries({ queryKey: ['knowledge-base-items', slug, knowledgeBaseId] })
    },
    onError: (error) => {
      console.error('Error deleting properties:', error)
      toast.error('Failed to delete properties')
    },
  })

  // Retry mutation
  const retryMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const response = await fetch(
        `/api/${slug}/knowledge-bases/${knowledgeBaseId}/items/${itemId}/retry`,
        { method: 'POST' }
      )
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to retry property')
      }
      return response.json()
    },
    onSuccess: () => {
      toast.success('Property queued for reprocessing')
      queryClient.invalidateQueries({ queryKey: ['knowledge-base-items', slug, knowledgeBaseId] })
    },
    onError: (error) => {
      console.error('Error retrying property:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to retry property')
    },
  })

  // Filter and sort properties
  const filteredAndSortedProperties = useMemo(() => {
    let filtered = properties

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((p) => p.status === statusFilter)
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      const aMetadata = a.metadata as RightmovePropertyMetadata | undefined
      const bMetadata = b.metadata as RightmovePropertyMetadata | undefined

      if (sortBy === 'price') {
        const aPrice = aMetadata?.price || 0
        const bPrice = bMetadata?.price || 0
        return sortOrder === 'asc' ? aPrice - bPrice : bPrice - aPrice
      } else if (sortBy === 'beds') {
        const aBeds = aMetadata?.beds || 0
        const bBeds = bMetadata?.beds || 0
        return sortOrder === 'asc' ? aBeds - bBeds : bBeds - aBeds
      } else {
        // Sort by date
        const aDate = new Date(a.created_at).getTime()
        const bDate = new Date(b.created_at).getTime()
        return sortOrder === 'asc' ? aDate - bDate : bDate - aDate
      }
    })

    return sorted
  }, [properties, statusFilter, sortBy, sortOrder])

  // Paginate
  const paginatedProperties = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return filteredAndSortedProperties.slice(startIndex, endIndex)
  }, [filteredAndSortedProperties, currentPage, pageSize])

  const totalPages = Math.ceil(filteredAndSortedProperties.length / pageSize)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [statusFilter, pageSize, sortBy, sortOrder])

  // Clear selection when filters or page changes
  useEffect(() => {
    setSelectedIds(new Set())
  }, [statusFilter, currentPage, pageSize])

  const toggleItem = (itemId: string) => {
    setSelectedIds((prev) => {
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
    if (selectedIds.size === paginatedProperties.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(paginatedProperties.map((p) => p.id)))
    }
  }

  const handleDelete = () => {
    if (!itemToDelete) return
    if (itemToDelete === 'bulk') {
      bulkDeleteMutation.mutate(Array.from(selectedIds))
    } else {
      deleteMutation.mutate(itemToDelete)
    }
  }

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

  const allSelected = paginatedProperties.length > 0 && selectedIds.size === paginatedProperties.length

  if (properties.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconDatabase />
          </EmptyMedia>
          <EmptyTitle>No Properties</EmptyTitle>
          <EmptyDescription>
            This estate agent has no properties yet. Properties will appear here once they are synced.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters and Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
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

          {/* Sort By */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Sort:</span>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date Added</SelectItem>
                <SelectItem value="price">Price</SelectItem>
                <SelectItem value="beds">Bedrooms</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </Button>
          </div>
        </div>

        {/* Page Size */}
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

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setItemToDelete('bulk')}
            disabled={bulkDeleteMutation.isPending}
          >
            <IconTrash className="mr-2 h-4 w-4" />
            Delete Selected ({selectedIds.size})
          </Button>
        </div>
      )}

      {/* Results Info */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredAndSortedProperties.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
        {Math.min(currentPage * pageSize, filteredAndSortedProperties.length)} of{' '}
        {filteredAndSortedProperties.length} propert{filteredAndSortedProperties.length !== 1 ? 'ies' : 'y'}
        {statusFilter !== 'all' && ` (filtered from ${properties.length} total)`}
      </div>

      {filteredAndSortedProperties.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconDatabase />
            </EmptyMedia>
            <EmptyTitle>No Matching Properties</EmptyTitle>
            <EmptyDescription>
              No properties match your current filters. Try adjusting your filter settings.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                  </TableHead>
                  <TableHead className="w-[80px]">Image</TableHead>
                  <TableHead className="w-[35%]">Title</TableHead>
                  <TableHead className="w-[15%]">Address</TableHead>
                  <TableHead className="w-[10%]">Beds/Baths</TableHead>
                  <TableHead className="w-[12%]">Price</TableHead>
                  <TableHead className="w-[10%]">Type</TableHead>
                  <TableHead className="w-[10%]">Status</TableHead>
                  <TableHead className="w-[10%] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedProperties.map((property) => {
                  const metadata = property.metadata as RightmovePropertyMetadata | undefined
                  const isFailed = property.status === 'failed'
                  const thumbnail = metadata?.images?.[0]

                  return (
                    <TableRow key={property.id} className="group">
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(property.id)}
                          onCheckedChange={() => toggleItem(property.id)}
                          aria-label={`Select ${property.name}`}
                        />
                      </TableCell>
                      <TableCell>
                        {thumbnail ? (
                          <div className="relative w-16 h-12 rounded overflow-hidden bg-muted">
                            <Image
                              src={thumbnail}
                              alt={metadata?.title || 'Property'}
                              fill
                              className="object-cover"
                              sizes="64px"
                            />
                          </div>
                        ) : (
                          <div className="w-16 h-12 rounded bg-muted flex items-center justify-center">
                            <IconDatabase className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="line-clamp-2 text-sm">{metadata?.title || property.name}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground line-clamp-2">
                          {metadata?.address || '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3 text-sm">
                          {metadata?.beds !== undefined && (
                            <span className="flex items-center gap-1">
                              <IconBed className="h-4 w-4" />
                              {metadata.beds}
                            </span>
                          )}
                          {metadata?.baths !== undefined && (
                            <span className="flex items-center gap-1">
                              <IconBath className="h-4 w-4" />
                              {metadata.baths}
                            </span>
                          )}
                          {metadata?.beds === undefined && metadata?.baths === undefined && '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{metadata?.primaryPrice || '-'}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {metadata?.propertySubType || metadata?.propertyType || '-'}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(property.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {property.url && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              asChild
                            >
                              <a
                                href={property.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="View on Rightmove"
                              >
                                <IconExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          {isFailed && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => retryMutation.mutate(property.id)}
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
                            onClick={() => setItemToDelete(property.id)}
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <IconChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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

      {/* Delete Dialog */}
      <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {itemToDelete === 'bulk'
                ? `This will permanently delete ${selectedIds.size} propert${selectedIds.size !== 1 ? 'ies' : 'y'} from your knowledge base. This action cannot be undone.`
                : 'This will permanently delete this property from your knowledge base. This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending || bulkDeleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending || bulkDeleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending || bulkDeleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

