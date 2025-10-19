'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, Plus, Minus } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface KnowledgeBase {
  id: string
  name: string
  description: string | null
  created_at: string
}

interface AgentKnowledgeBasesProps {
  agentId: string
  slug: string
}

export function AgentKnowledgeBases({ agentId, slug }: AgentKnowledgeBasesProps) {
  const [assignedKnowledgeBases, setAssignedKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [availableKnowledgeBases, setAvailableKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [assigningKbId, setAssigningKbId] = useState<string | null>(null)
  const [unassigningKbId, setUnassigningKbId] = useState<string | null>(null)

  // Fetch knowledge bases
  const fetchKnowledgeBases = async () => {
    try {
      setIsLoading(true)

      // Fetch assigned knowledge bases for this agent
      const assignedResponse = await fetch(`/api/${slug}/agents/${agentId}/knowledge-bases`)
      const assignedData = await assignedResponse.json()

      if (!assignedData.success) {
        toast.error('Failed to load assigned knowledge bases')
        return
      }

      // Fetch all knowledge bases in the organization
      const allKbResponse = await fetch(`/api/${slug}/knowledge-bases`)
      const allKbData = await allKbResponse.json()

      const assigned = assignedData.knowledgeBases || []
      setAssignedKnowledgeBases(assigned)

      // Filter out already assigned knowledge bases from available ones
      const assignedIds = new Set(assigned.map((kb: KnowledgeBase) => kb.id))
      const available = (allKbData.knowledgeBases || []).filter(
        (kb: KnowledgeBase) => !assignedIds.has(kb.id)
      )
      setAvailableKnowledgeBases(available)
    } catch (error) {
      console.error('Error fetching knowledge bases:', error)
      toast.error('Failed to load knowledge bases')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchKnowledgeBases()
  }, [agentId, slug])

  // Assign a knowledge base to the agent
  const handleAssignKnowledgeBase = async (knowledgeBaseId: string) => {
    // Find the knowledge base to assign
    const kbToAssign = availableKnowledgeBases.find(kb => kb.id === knowledgeBaseId)
    if (!kbToAssign) return

    // Optimistically update the UI
    setAvailableKnowledgeBases(prev => prev.filter(kb => kb.id !== knowledgeBaseId))
    setAssignedKnowledgeBases(prev => [...prev, kbToAssign])
    setAssigningKbId(knowledgeBaseId)

    try {
      const response = await fetch(`/api/${slug}/agents/${agentId}/knowledge-bases/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ knowledgeBaseId }),
      })

      const data = await response.json()

      if (!data.success) {
        // Revert optimistic update
        setAssignedKnowledgeBases(prev => prev.filter(kb => kb.id !== knowledgeBaseId))
        setAvailableKnowledgeBases(prev => [...prev, kbToAssign])
        toast.error(data.error || 'Failed to assign knowledge base')
        return
      }

      toast.success('Knowledge base assigned successfully')
    } catch (error) {
      // Revert optimistic update
      setAssignedKnowledgeBases(prev => prev.filter(kb => kb.id !== knowledgeBaseId))
      setAvailableKnowledgeBases(prev => [...prev, kbToAssign])
      console.error('Error assigning knowledge base:', error)
      toast.error('Failed to assign knowledge base')
    } finally {
      setAssigningKbId(null)
    }
  }

  // Unassign a knowledge base from the agent
  const handleUnassignKnowledgeBase = async (knowledgeBaseId: string) => {
    // Find the knowledge base to unassign
    const kbToUnassign = assignedKnowledgeBases.find(kb => kb.id === knowledgeBaseId)
    if (!kbToUnassign) return

    // Optimistically update the UI
    setAssignedKnowledgeBases(prev => prev.filter(kb => kb.id !== knowledgeBaseId))
    setAvailableKnowledgeBases(prev => [...prev, kbToUnassign])
    setUnassigningKbId(knowledgeBaseId)

    try {
      const response = await fetch(`/api/${slug}/agents/${agentId}/knowledge-bases/unassign`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ knowledgeBaseId }),
      })

      const data = await response.json()

      if (!data.success) {
        // Revert optimistic update
        setAvailableKnowledgeBases(prev => prev.filter(kb => kb.id !== knowledgeBaseId))
        setAssignedKnowledgeBases(prev => [...prev, kbToUnassign])
        toast.error(data.error || 'Failed to unassign knowledge base')
        return
      }

      toast.success('Knowledge base unassigned successfully')
    } catch (error) {
      // Revert optimistic update
      setAvailableKnowledgeBases(prev => prev.filter(kb => kb.id !== knowledgeBaseId))
      setAssignedKnowledgeBases(prev => [...prev, kbToUnassign])
      console.error('Error unassigning knowledge base:', error)
      toast.error('Failed to unassign knowledge base')
    } finally {
      setUnassigningKbId(null)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Assigned Knowledge Bases */}
      <Card>
        <CardHeader>
          <CardTitle>Assigned Knowledge Bases</CardTitle>
          <CardDescription>
            Knowledge bases currently available to this agent for retrieval
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assignedKnowledgeBases.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No knowledge bases assigned yet. Assign knowledge bases from the available list below.
            </p>
          ) : (
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
                  {assignedKnowledgeBases.map((kb) => (
                    <TableRow key={kb.id}>
                      <TableCell className="font-medium">
                        <Link 
                          href={`/${slug}/knowledge-base/${kb.id}`} 
                          className="hover:underline"
                          prefetch={true}
                        >
                          {kb.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {kb.description || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(kb.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnassignKnowledgeBase(kb.id)}
                          disabled={unassigningKbId === kb.id}
                        >
                          {unassigningKbId === kb.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Minus className="h-4 w-4 mr-2" />
                              Unassign
                            </>
                          )}
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

      {/* Available Knowledge Bases */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Available Knowledge Bases</CardTitle>
              <CardDescription>
                Knowledge bases you can assign to this agent
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/${slug}/knowledge-base/create`} prefetch={true}>
                <Plus className="h-4 w-4 mr-2" />
                Create Knowledge Base
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {availableKnowledgeBases.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {assignedKnowledgeBases.length > 0
                ? 'All available knowledge bases are already assigned to this agent.'
                : 'No knowledge bases available. Create a knowledge base to get started.'}
            </p>
          ) : (
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
                  {availableKnowledgeBases.map((kb) => (
                    <TableRow key={kb.id}>
                      <TableCell className="font-medium">
                        <Link 
                          href={`/${slug}/knowledge-base/${kb.id}`} 
                          className="hover:underline"
                          prefetch={true}
                        >
                          {kb.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {kb.description || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(kb.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAssignKnowledgeBase(kb.id)}
                          disabled={assigningKbId === kb.id}
                        >
                          {assigningKbId === kb.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Plus className="h-4 w-4 mr-2" />
                              Assign
                            </>
                          )}
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
    </div>
  )
}

