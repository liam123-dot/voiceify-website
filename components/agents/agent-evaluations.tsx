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

interface Evaluation {
  id: string
  name: string
  description: string | null
  created_at: string
}

interface AgentEvaluationsProps {
  agentId: string
  slug: string
}

export function AgentEvaluations({ agentId, slug }: AgentEvaluationsProps) {
  const [assignedEvaluations, setAssignedEvaluations] = useState<Evaluation[]>([])
  const [availableEvaluations, setAvailableEvaluations] = useState<Evaluation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [assigningEvalId, setAssigningEvalId] = useState<string | null>(null)
  const [unassigningEvalId, setUnassigningEvalId] = useState<string | null>(null)

  // Fetch evaluations
  const fetchEvaluations = async () => {
    try {
      setIsLoading(true)

      // Fetch assigned evaluations for this agent
      const assignedResponse = await fetch(`/api/${slug}/agents/${agentId}/evaluations`)
      const assignedData = await assignedResponse.json()

      if (!assignedData.success) {
        toast.error('Failed to load assigned evaluations')
        return
      }

      // Fetch all evaluations in the organization
      const allEvalsResponse = await fetch(`/api/${slug}/evaluations`)
      const allEvalsData = await allEvalsResponse.json()

      const assigned = assignedData.evaluations || []
      setAssignedEvaluations(assigned)

      // Filter out already assigned evaluations from available ones
      const assignedIds = new Set(assigned.map((evaluation: Evaluation) => evaluation.id))
      const available = (allEvalsData.evaluations || []).filter(
        (evaluation: Evaluation) => !assignedIds.has(evaluation.id)
      )
      setAvailableEvaluations(available)
    } catch (error) {
      console.error('Error fetching evaluations:', error)
      toast.error('Failed to load evaluations')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchEvaluations()
  }, [agentId, slug])

  // Assign an evaluation to the agent
  const handleAssignEvaluation = async (evaluationId: string) => {
    // Find the evaluation to assign
    const evalToAssign = availableEvaluations.find(e => e.id === evaluationId)
    if (!evalToAssign) return

    // Optimistically update the UI
    setAvailableEvaluations(prev => prev.filter(e => e.id !== evaluationId))
    setAssignedEvaluations(prev => [...prev, evalToAssign])
    setAssigningEvalId(evaluationId)

    try {
      const response = await fetch(`/api/${slug}/agents/${agentId}/evaluations/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluationId }),
      })

      const data = await response.json()

      if (!data.success) {
        // Revert optimistic update
        setAssignedEvaluations(prev => prev.filter(e => e.id !== evaluationId))
        setAvailableEvaluations(prev => [...prev, evalToAssign])
        toast.error(data.error || 'Failed to assign evaluation')
        return
      }

      toast.success('Evaluation assigned successfully')
    } catch (error) {
      // Revert optimistic update
      setAssignedEvaluations(prev => prev.filter(e => e.id !== evaluationId))
      setAvailableEvaluations(prev => [...prev, evalToAssign])
      console.error('Error assigning evaluation:', error)
      toast.error('Failed to assign evaluation')
    } finally {
      setAssigningEvalId(null)
    }
  }

  // Unassign an evaluation from the agent
  const handleUnassignEvaluation = async (evaluationId: string) => {
    // Find the evaluation to unassign
    const evalToUnassign = assignedEvaluations.find(e => e.id === evaluationId)
    if (!evalToUnassign) return

    // Optimistically update the UI
    setAssignedEvaluations(prev => prev.filter(e => e.id !== evaluationId))
    setAvailableEvaluations(prev => [...prev, evalToUnassign])
    setUnassigningEvalId(evaluationId)

    try {
      const response = await fetch(`/api/${slug}/agents/${agentId}/evaluations/unassign`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluationId }),
      })

      const data = await response.json()

      if (!data.success) {
        // Revert optimistic update
        setAvailableEvaluations(prev => prev.filter(e => e.id !== evaluationId))
        setAssignedEvaluations(prev => [...prev, evalToUnassign])
        toast.error(data.error || 'Failed to unassign evaluation')
        return
      }

      toast.success('Evaluation unassigned successfully')
    } catch (error) {
      // Revert optimistic update
      setAvailableEvaluations(prev => prev.filter(e => e.id !== evaluationId))
      setAssignedEvaluations(prev => [...prev, evalToUnassign])
      console.error('Error unassigning evaluation:', error)
      toast.error('Failed to unassign evaluation')
    } finally {
      setUnassigningEvalId(null)
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
      {/* Assigned Evaluations */}
      <Card>
        <CardHeader>
          <CardTitle>Assigned Evaluations</CardTitle>
          <CardDescription>
            Evaluations currently assigned to this agent for processing call transcripts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assignedEvaluations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No evaluations assigned yet. Assign evaluations from the available list below.
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
                  {assignedEvaluations.map((evaluation) => (
                    <TableRow key={evaluation.id}>
                      <TableCell className="font-medium">
                        <Link 
                          href={`/${slug}/evaluations/${evaluation.id}`} 
                          className="hover:underline"
                          prefetch={true}
                        >
                          {evaluation.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {evaluation.description || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(evaluation.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnassignEvaluation(evaluation.id)}
                          disabled={unassigningEvalId === evaluation.id}
                        >
                          {unassigningEvalId === evaluation.id ? (
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

      {/* Available Evaluations */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Available Evaluations</CardTitle>
              <CardDescription>
                Evaluations you can assign to this agent
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/${slug}/evaluations/create`} prefetch={true}>
                <Plus className="h-4 w-4 mr-2" />
                Create Evaluation
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {availableEvaluations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {assignedEvaluations.length > 0
                ? 'All available evaluations are already assigned to this agent.'
                : 'No evaluations available. Create an evaluation to get started.'}
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
                  {availableEvaluations.map((evaluation) => (
                    <TableRow key={evaluation.id}>
                      <TableCell className="font-medium">
                        <Link 
                          href={`/${slug}/evaluations/${evaluation.id}`} 
                          className="hover:underline"
                          prefetch={true}
                        >
                          {evaluation.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {evaluation.description || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(evaluation.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAssignEvaluation(evaluation.id)}
                          disabled={assigningEvalId === evaluation.id}
                        >
                          {assigningEvalId === evaluation.id ? (
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

