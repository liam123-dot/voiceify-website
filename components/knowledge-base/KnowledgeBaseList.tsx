'use client'

import { useState, useEffect } from "react"
import { IconDatabase, IconLoader2, IconPlus, IconTrash } from "@tabler/icons-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
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

interface AgentInfo {
  id: string
  name: string
}

interface KnowledgeBase {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
  agents: AgentInfo[]
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
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12"></TableHead>
                <TableHead className="font-semibold">Name</TableHead>
                <TableHead className="font-semibold">Description</TableHead>
                <TableHead className="font-semibold">Agents</TableHead>
                <TableHead className="font-semibold">Created</TableHead>
                <TableHead className="text-right font-semibold w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(3)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="text-center">
                    <Skeleton className="h-4 w-4 mx-auto" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-48" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-8 w-8 ml-auto" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12"></TableHead>
                <TableHead className="font-semibold">Name</TableHead>
                <TableHead className="font-semibold">Description</TableHead>
                <TableHead className="font-semibold">Agents</TableHead>
                <TableHead className="font-semibold">Created</TableHead>
                <TableHead className="text-right font-semibold w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {knowledgeBases.map((kb) => {
                const agentCount = kb.agents?.length || 0
                
                return (
                  <TableRow 
                    key={kb.id}
                    className="hover:bg-muted/30 cursor-pointer group"
                    onClick={() => router.push(`/${slug}/knowledge-base/${kb.id}`)}
                  >
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center text-muted-foreground">
                        <IconDatabase className="h-4 w-4" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{kb.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground line-clamp-1">
                        {kb.description || '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {agentCount === 0 ? (
                          <span className="text-sm text-muted-foreground opacity-50">
                            No agents
                          </span>
                        ) : agentCount <= 2 ? (
                          kb.agents.map((agent) => (
                            <Badge
                              key={agent.id}
                              variant="secondary"
                              className="text-xs"
                            >
                              {agent.name}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            {agentCount} agents
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(kb.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        disabled={isDeleting}
                        onClick={(e) => handleDeleteClick(kb, e)}
                      >
                        {isDeleting && knowledgeBaseToDelete?.id === kb.id ? (
                          <IconLoader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <IconTrash className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
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