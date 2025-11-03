'use client'

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { IconRobot, IconLoader2, IconPlus, IconTrash } from "@tabler/icons-react"
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
import { useRouter } from "next/navigation"

interface Tool {
  id: string
  name: string
}

interface KnowledgeBase {
  id: string
  name: string
}

interface PhoneNumber {
  id: string
  number: string
}

interface Agent {
  id: string
  name: string
  created_at: string
  tools: Tool[]
  knowledge_bases: KnowledgeBase[]
  phone_numbers: PhoneNumber[]
}

interface AgentsListProps {
  slug: string
}

export function AgentsList({ slug }: AgentsListProps) {
  const router = useRouter()
  const [agents, setAgents] = useState<Agent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchAgents = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/${slug}/agents`)
      const data = await response.json()
      setAgents(data.agents || [])
    } catch (error) {
      console.error('Error fetching agents:', error)
    } finally {
      setIsLoading(false)
    }
  }, [slug])

  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  const handleDeleteClick = (agent: Agent, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setAgentToDelete(agent)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!agentToDelete) return

    try {
      setIsDeleting(true)
      const response = await fetch(`/api/${slug}/agents/${agentToDelete.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete agent')
      }

      toast.success('Agent deleted successfully')
      setDeleteDialogOpen(false)
      setAgentToDelete(null)
      fetchAgents()
    } catch (error) {
      console.error('Error deleting agent:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete agent')
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12"></TableHead>
                <TableHead className="font-semibold">Name</TableHead>
                <TableHead className="font-semibold">Tools</TableHead>
                <TableHead className="font-semibold">Knowledge Bases</TableHead>
                <TableHead className="font-semibold">Phone Numbers</TableHead>
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
                    <Skeleton className="h-5 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16" />
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

  if (agents.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconRobot />
          </EmptyMedia>
          <EmptyTitle>No Agents Yet</EmptyTitle>
          <EmptyDescription>
            You haven&apos;t created any agents yet. Get started by creating
            your first AI voice agent.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Link href={`/${slug}/agents/create`} prefetch>
            <Button>
              <IconPlus className="mr-2 h-4 w-4" />
              Create Agent
            </Button>
          </Link>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {agents.length} {agents.length === 1 ? 'agent' : 'agents'}
          </p>
          <Link href={`/${slug}/agents/create`} prefetch>
            <Button>
              <IconPlus className="mr-2 h-4 w-4" />
              Create Agent
            </Button>
          </Link>
        </div>
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12"></TableHead>
                <TableHead className="font-semibold">Name</TableHead>
                <TableHead className="font-semibold">Tools</TableHead>
                <TableHead className="font-semibold">Knowledge Bases</TableHead>
                <TableHead className="font-semibold">Phone Numbers</TableHead>
                <TableHead className="font-semibold">Created</TableHead>
                <TableHead className="text-right font-semibold w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map((agent) => (
                <TableRow 
                  key={agent.id}
                  className="hover:bg-muted/30 cursor-pointer group"
                  onClick={() => router.push(`/${slug}/agents/${agent.id}`)}
                >
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center text-muted-foreground">
                      <IconRobot className="h-4 w-4" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Link 
                      href={`/${slug}/agents/${agent.id}`} 
                      prefetch
                      className="font-medium text-sm"
                    >
                      {agent.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {agent.tools.length === 0 ? (
                        <span className="text-sm text-muted-foreground opacity-50">
                          No tools
                        </span>
                      ) : agent.tools.length <= 2 ? (
                        agent.tools.map((tool) => (
                          <Badge
                            key={tool.id}
                            variant="secondary"
                            className="text-xs"
                          >
                            {tool.name}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          {agent.tools.length} tools
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {agent.knowledge_bases.length === 0 ? (
                        <span className="text-sm text-muted-foreground opacity-50">
                          No KBs
                        </span>
                      ) : agent.knowledge_bases.length <= 2 ? (
                        agent.knowledge_bases.map((kb) => (
                          <Badge
                            key={kb.id}
                            variant="secondary"
                            className="text-xs"
                          >
                            {kb.name}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          {agent.knowledge_bases.length} KBs
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {agent.phone_numbers.length === 0 ? (
                        <span className="text-sm text-muted-foreground opacity-50">
                          No numbers
                        </span>
                      ) : agent.phone_numbers.length <= 2 ? (
                        agent.phone_numbers.map((pn) => (
                          <Badge
                            key={pn.id}
                            variant="secondary"
                            className="text-xs"
                          >
                            {pn.number}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          {agent.phone_numbers.length} numbers
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(agent.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      disabled={isDeleting}
                      onClick={(e) => handleDeleteClick(agent, e)}
                    >
                      {isDeleting && agentToDelete?.id === agent.id ? (
                        <IconLoader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <IconTrash className="h-4 w-4" />
                      )}
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
            <AlertDialogTitle>Delete Agent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{agentToDelete?.name}&quot;? This will permanently delete:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>The agent and its configuration</li>
                <li>All tool associations</li>
                <li>All knowledge base associations</li>
                <li>All phone number assignments</li>
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

