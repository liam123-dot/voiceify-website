'use client'

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { IconLoader2, IconTrash, IconFile, IconLink, IconFileText, IconDatabase } from "@tabler/icons-react"
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

interface KnowledgeBaseItemsTableProps {
  slug: string
  knowledgeBaseId: string
}

export function KnowledgeBaseItemsTable({ slug, knowledgeBaseId }: KnowledgeBaseItemsTableProps) {
  const [itemToDelete, setItemToDelete] = useState<string | null>(null)
  const queryClient = useQueryClient()

  // Fetch knowledge base items
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
      const items = query.state.data as KnowledgeBaseItem[] || []
      const hasProcessingItems = items.some(
        item => item.status === 'pending' || item.status === 'processing'
      )
      // Refetch every 5 seconds if there are processing items
      return hasProcessingItems ? 5000 : false
    },
  })

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
        return <Badge variant="default" className="bg-green-500">Indexed</Badge>
      case 'processing':
        return <Badge variant="default" className="bg-blue-500">Processing</Badge>
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'file':
        return <IconFile className="h-4 w-4" />
      case 'url':
        return <IconLink className="h-4 w-4" />
      case 'text':
        return <IconFileText className="h-4 w-4" />
      default:
        return null
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
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
    )
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item: KnowledgeBaseItem) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {getTypeIcon(item.type)}
                    <span className="truncate max-w-md">{item.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {item.type}
                  </Badge>
                </TableCell>
                <TableCell>{getStatusBadge(item.status)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(item.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
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
    </>
  )
}

