'use client'

import { useState, useEffect, useCallback } from "react"
import { IconFlask, IconLoader2, IconPlus, IconTrash } from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
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
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

interface AgentInfo {
  id: string
  name: string
}

interface Evaluation {
  id: string
  name: string
  description: string | null
  prompt: string
  model_provider: string
  model_name: string
  output_schema: Record<string, unknown> | null
  created_at: string
  updated_at: string
  agents: AgentInfo[]
}

interface EvaluationsListProps {
  slug: string
}

export function EvaluationsList({ slug }: EvaluationsListProps) {
  const router = useRouter()
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [evaluationToDelete, setEvaluationToDelete] = useState<Evaluation | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchEvaluations = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/${slug}/evaluations`)
      const data = await response.json()
      setEvaluations(data.evaluations || [])
    } catch (error) {
      console.error('Error fetching evaluations:', error)
    } finally {
      setIsLoading(false)
    }
  }, [slug])

  useEffect(() => {
    fetchEvaluations()
  }, [fetchEvaluations])

  const handleDeleteClick = (evaluation: Evaluation, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setEvaluationToDelete(evaluation)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!evaluationToDelete) return

    try {
      setIsDeleting(true)
      const response = await fetch(`/api/${slug}/evaluations/${evaluationToDelete.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete evaluation')
      }

      toast.success('Evaluation deleted successfully')
      setDeleteDialogOpen(false)
      setEvaluationToDelete(null)
      fetchEvaluations()
    } catch (error) {
      console.error('Error deleting evaluation:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete evaluation')
    } finally {
      setIsDeleting(false)
    }
  }

  const getProviderBadge = (provider: string) => {
    type BadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive'
    const variants: Record<string, BadgeVariant> = {
      'openai': 'default',
      'anthropic': 'secondary',
      'google': 'outline',
      'custom-llm': 'default',
    }
    return (
      <Badge variant={(variants[provider] || 'default') as BadgeVariant}>
        {provider}
      </Badge>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12"></TableHead>
                <TableHead className="font-semibold">Name</TableHead>
                <TableHead className="font-semibold">Description</TableHead>
                <TableHead className="font-semibold">Model</TableHead>
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
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-3 w-24" />
                    </div>
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

  if (evaluations.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconFlask />
          </EmptyMedia>
          <EmptyTitle>No Evaluations Yet</EmptyTitle>
          <EmptyDescription>
            You haven&apos;t created any evaluations yet. Get started by creating
            your first evaluation.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={() => router.push(`/${slug}/evaluations/create`)}>
            <IconPlus className="mr-2 h-4 w-4" />
            Create Evaluation
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
            {evaluations.length} {evaluations.length === 1 ? 'evaluation' : 'evaluations'}
          </p>
          <Button onClick={() => router.push(`/${slug}/evaluations/create`)}>
            <IconPlus className="mr-2 h-4 w-4" />
            Create Evaluation
          </Button>
        </div>
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12"></TableHead>
                <TableHead className="font-semibold">Name</TableHead>
                <TableHead className="font-semibold">Description</TableHead>
                <TableHead className="font-semibold">Model</TableHead>
                <TableHead className="font-semibold">Agents</TableHead>
                <TableHead className="font-semibold">Created</TableHead>
                <TableHead className="text-right font-semibold w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {evaluations.map((evaluation) => {
                const agentCount = evaluation.agents?.length || 0
                
                return (
                  <TableRow 
                    key={evaluation.id}
                    className="hover:bg-muted/30 cursor-pointer group"
                    onClick={() => router.push(`/${slug}/evaluations/${evaluation.id}`)}
                  >
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center text-muted-foreground">
                        <IconFlask className="h-4 w-4" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{evaluation.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground line-clamp-1">
                        {evaluation.description || '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getProviderBadge(evaluation.model_provider)}
                        <span className="text-xs text-muted-foreground">
                          {evaluation.model_name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {agentCount === 0 ? (
                          <span className="text-sm text-muted-foreground opacity-50">
                            No agents
                          </span>
                        ) : agentCount <= 2 ? (
                          evaluation.agents.map((agent) => (
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
                      {new Date(evaluation.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        disabled={isDeleting}
                        onClick={(e) => handleDeleteClick(evaluation, e)}
                      >
                        {isDeleting && evaluationToDelete?.id === evaluation.id ? (
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
            <AlertDialogTitle>Delete Evaluation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{evaluationToDelete?.name}&quot;? This will permanently delete:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>The evaluation</li>
                <li>All agent associations</li>
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

