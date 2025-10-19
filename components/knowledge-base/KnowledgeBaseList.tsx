'use client'

import { useState, useEffect } from "react"
import { IconDatabase, IconLoader2, IconPlus, IconTrash } from "@tabler/icons-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { toast } from "sonner"

interface KnowledgeBase {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

interface KnowledgeBaseListProps {
  slug: string
}

export function KnowledgeBaseList({ slug }: KnowledgeBaseListProps) {
  const router = useRouter()
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [knowledgeBaseToDelete, setKnowledgeBaseToDelete] = useState<KnowledgeBase | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchKnowledgeBases = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/${slug}/knowledge-bases`)
      const data = await response.json()
      setKnowledgeBases(data.knowledgeBases || [])
    } catch (error) {
      console.error('Error fetching knowledge bases:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchKnowledgeBases()
  }, [slug])

  const handleDeleteClick = (kb: KnowledgeBase, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setKnowledgeBaseToDelete(kb)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!knowledgeBaseToDelete) return

    try {
      setIsDeleting(true)
      const response = await fetch(`/api/${slug}/knowledge-bases/${knowledgeBaseToDelete.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete knowledge base')
      }

      toast.success('Knowledge base deleted successfully')
      setDeleteDialogOpen(false)
      setKnowledgeBaseToDelete(null)
      fetchKnowledgeBases()
    } catch (error) {
      console.error('Error deleting knowledge base:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete knowledge base')
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (knowledgeBases.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconDatabase />
          </EmptyMedia>
          <EmptyTitle>No Knowledge Bases Yet</EmptyTitle>
          <EmptyDescription>
            You haven&apos;t created any knowledge bases yet. Get started by creating
            your first knowledge base.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={() => router.push(`/${slug}/knowledge-base/create`)}>
            <IconPlus className="mr-2 h-4 w-4" />
            Create Knowledge Base
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {knowledgeBases.length} {knowledgeBases.length === 1 ? 'knowledge base' : 'knowledge bases'}
          </p>
          <Button onClick={() => router.push(`/${slug}/knowledge-base/create`)}>
            <IconPlus className="mr-2 h-4 w-4" />
            Create Knowledge Base
          </Button>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {knowledgeBases.map((kb) => (
                <TableRow key={kb.id}>
                  <TableCell className="font-medium">
                    <Link 
                      href={`/${slug}/knowledge-base/${kb.id}`} 
                      className="hover:underline flex items-center gap-2"
                      prefetch={true}
                    >
                      <IconDatabase className="h-4 w-4" />
                      {kb.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-md truncate">
                    {kb.description || '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(kb.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleDeleteClick(kb, e)}
                    >
                      <IconTrash className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Knowledge Base</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{knowledgeBaseToDelete?.name}&quot;? This will permanently delete:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>The knowledge base</li>
                <li>All items in this knowledge base</li>
                <li>All agent associations</li>
                <li>All indexed documents in Ragie</li>
              </ul>
              <p className="mt-2 font-semibold">This action cannot be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}