'use client'

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { IconLoader2, IconTrash, IconFile, IconLink, IconFileText, IconDatabase, IconExternalLink } from "@tabler/icons-react"
import Link from 'next/link'
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
  EmptyContent,
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
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Skeleton } from '@/components/ui/skeleton'
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

  // Delete mutation
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
    onSuccess: () => {
      toast.success('Item deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['knowledge-base-items', slug, knowledgeBaseId] })
      setItemToDelete(null)
    },
    onError: (error) => {
      console.error('Error deleting item:', error)
      toast.error('Failed to delete item')
    },
  })

  const handleDelete = () => {
    if (!itemToDelete) return
    deleteMutation.mutate(itemToDelete)
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

  const isLoading = isLoadingKB || isLoadingItems

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
            <AddItemDialog 
              slug={slug} 
              knowledgeBaseId={knowledgeBaseId} 
              onItemAdded={handleItemAdded}
            />
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
                  {items.map((item: KnowledgeBaseItem) => (
                    <TableRow key={item.id} className="group">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0">
                            {getTypeIcon(item.type)}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="truncate text-sm font-medium">
                              {item.name}
                            </span>
                            {item.url && (
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-muted-foreground hover:text-primary truncate flex items-center gap-1 mt-0.5"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="truncate">{item.url}</span>
                                <IconExternalLink className="h-3 w-3 flex-shrink-0" />
                              </a>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-xs">
                          {item.type}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(item.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => setItemToDelete(item.id)}
                        >
                          <IconTrash className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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

