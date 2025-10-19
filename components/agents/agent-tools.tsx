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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, Loader2, Minus, MessageSquare, PhoneForwarded, Code2, Mail } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import Link from 'next/link'

interface Tool {
  id: string
  name: string
  label: string
  type: string
  description: string | null
  config_metadata?: Record<string, unknown>
}

type AssignedTool = Tool

interface AgentToolsProps {
  agentId: string
  slug: string
}

export function AgentTools({ agentId, slug }: AgentToolsProps) {
  const [assignedTools, setAssignedTools] = useState<AssignedTool[]>([])
  const [availableTools, setAvailableTools] = useState<Tool[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [assigningToolId, setAssigningToolId] = useState<string | null>(null)
  const [unassigningToolId, setUnassigningToolId] = useState<string | null>(null)

  // Fetch tools
  const fetchTools = async () => {
    try {
      setIsLoading(true)

      // Fetch assigned tools for this agent
      const assignedResponse = await fetch(`/api/${slug}/agents/${agentId}/tools`)
      const assignedData = await assignedResponse.json()

      if (!assignedData.success) {
        toast.error('Failed to load assigned tools')
        return
      }

      // Fetch all tools in the organization
      const allToolsResponse = await fetch(`/api/${slug}/tools`)
      const allToolsData = await allToolsResponse.json()

      if (!allToolsData.success) {
        toast.error('Failed to load available tools')
        return
      }

      const assigned = assignedData.tools.map((t: {
        id: string;
        name: string;
        label: string;
        type: string;
        configMetadata?: { description?: string } & Record<string, unknown>;
      }) => ({
        id: t.id,
        name: t.name,
        label: t.label,
        type: t.type,
        description: t.configMetadata?.description || null,
        config_metadata: t.configMetadata,
      }))

      setAssignedTools(assigned)

      // Filter out already assigned tools from available tools
      const assignedIds = new Set(assigned.map((t: Tool) => t.id))
      const available = allToolsData.tools.filter((t: Tool) => !assignedIds.has(t.id))
      setAvailableTools(available)
    } catch (error) {
      console.error('Error fetching tools:', error)
      toast.error('Failed to load tools')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTools()
  }, [agentId])

  // Assign a tool to the agent
  const handleAssignTool = async (toolId: string) => {
    // Find the tool to assign
    const toolToAssign = availableTools.find(t => t.id === toolId)
    if (!toolToAssign) return

    // Optimistically update the UI
    setAvailableTools(prev => prev.filter(t => t.id !== toolId))
    setAssignedTools(prev => [...prev, toolToAssign])
    setAssigningToolId(toolId)

    try {
      const response = await fetch(`/api/${slug}/agents/${agentId}/tools/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId }),
      })

      const data = await response.json()

      if (!data.success) {
        // Revert optimistic update
        setAssignedTools(prev => prev.filter(t => t.id !== toolId))
        setAvailableTools(prev => [...prev, toolToAssign])
        toast.error(data.error || 'Failed to assign tool')
        return
      }

      toast.success('Tool assigned successfully')
    } catch (error) {
      // Revert optimistic update
      setAssignedTools(prev => prev.filter(t => t.id !== toolId))
      setAvailableTools(prev => [...prev, toolToAssign])
      console.error('Error assigning tool:', error)
      toast.error('Failed to assign tool')
    } finally {
      setAssigningToolId(null)
    }
  }

  // Unassign a tool from the agent
  const handleUnassignTool = async (toolId: string) => {
    // Find the tool to unassign
    const toolToUnassign = assignedTools.find(t => t.id === toolId)
    if (!toolToUnassign) return

    // Optimistically update the UI
    setAssignedTools(prev => prev.filter(t => t.id !== toolId))
    setAvailableTools(prev => [...prev, toolToUnassign])
    setUnassigningToolId(toolId)

    try {
      const response = await fetch(`/api/${slug}/agents/${agentId}/tools/unassign`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId }),
      })

      const data = await response.json()

      if (!data.success) {
        // Revert optimistic update
        setAvailableTools(prev => prev.filter(t => t.id !== toolId))
        setAssignedTools(prev => [...prev, toolToUnassign])
        toast.error(data.error || 'Failed to unassign tool')
        return
      }

      toast.success('Tool unassigned successfully')
    } catch (error) {
      // Revert optimistic update
      setAvailableTools(prev => prev.filter(t => t.id !== toolId))
      setAssignedTools(prev => [...prev, toolToUnassign])
      console.error('Error unassigning tool:', error)
      toast.error('Failed to unassign tool')
    } finally {
      setUnassigningToolId(null)
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

  const getToolIcon = (tool: Tool) => {
    const metadata = tool.config_metadata as Record<string, unknown> | undefined
    const pipedreamMetadata = metadata?.pipedreamMetadata as Record<string, unknown> | undefined

    if (tool.type === 'pipedream_action' && pipedreamMetadata?.appImgSrc) {
      return (
        <img
          src={pipedreamMetadata.appImgSrc as string}
          alt={(pipedreamMetadata.appName as string) || 'App'}
          className="h-5 w-5 rounded object-cover"
        />
      )
    }

    switch (tool.type?.toLowerCase()) {
      case 'sms':
        return <MessageSquare className="h-4 w-4" />
      case 'transfer_call':
        return <PhoneForwarded className="h-4 w-4" />
      case 'pipedream_action':
        return <Code2 className="h-4 w-4" />
      case 'email':
      case 'send_email':
        return <Mail className="h-4 w-4" />
      default:
        return <Code2 className="h-4 w-4" />
    }
  }

  const getToolTypeDisplay = (tool: Tool): string => {
    if (tool.type === 'pipedream_action') {
      const metadata = tool.config_metadata as Record<string, unknown> | undefined
      const pipedreamMetadata = metadata?.pipedreamMetadata as Record<string, unknown> | undefined
      return (pipedreamMetadata?.appName as string) || 'External App'
    }
    
    switch (tool.type?.toLowerCase()) {
      case 'sms':
        return 'SMS'
      case 'transfer_call':
        return 'Transfer Call'
      case 'email':
      case 'send_email':
        return 'Email'
      default:
        return tool.type
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
    }
  }

  const getToolDetails = (tool: Tool): string | null => {
    if (!tool.config_metadata) return null

    const metadata = tool.config_metadata as Record<string, unknown>

    if (tool.type === 'pipedream_action') {
      // Show the action name for pipedream actions
      const pipedreamMetadata = metadata.pipedreamMetadata as Record<string, unknown> | undefined
      return (pipedreamMetadata?.actionName as string) || null
    }

    if (tool.type === 'transfer_call') {
      // Show the destination (agent name or phone number)
      const target = metadata.target as Record<string, unknown> | undefined
      if (target?.agentName) {
        return `Agent: ${target.agentName as string}`
      }
      if (target?.phoneNumber) {
        return `Phone: ${target.phoneNumber as string}`
      }
    }

    return null
  }

  const getToolBadgeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'sms':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
      case 'transfer_call':
        return 'bg-green-500/10 text-green-700 dark:text-green-400'
      case 'pipedream_action':
        return 'bg-slate-500/10 text-slate-700 dark:text-slate-400'
      case 'email':
      case 'send_email':
        return 'bg-orange-500/10 text-orange-700 dark:text-orange-400'
      default:
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400'
    }
  }

  return (
    <div className="space-y-6">
      {/* Assigned Tools */}
      <Card>
        <CardHeader>
          <CardTitle>Assigned Tools</CardTitle>
          <CardDescription>
            Tools currently available to this agent
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assignedTools.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No tools assigned yet. Assign tools from the available list below.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignedTools.map((tool) => {
                    const toolDetails = getToolDetails(tool)
                    return (
                      <TableRow key={tool.id}>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center text-muted-foreground">
                            {getToolIcon(tool)}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          <Link 
                            href={`/${slug}/tools/${tool.id}`} 
                            className="hover:underline"
                            prefetch={true}
                          >
                            {tool.label || tool.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getToolBadgeColor(tool.type)}>
                            {getToolTypeDisplay(tool)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-md truncate">
                          {toolDetails || '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUnassignTool(tool.id)}
                            disabled={unassigningToolId === tool.id}
                          >
                            {unassigningToolId === tool.id ? (
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
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Tools */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Available Tools</CardTitle>
              <CardDescription>
                Tools you can assign to this agent
              </CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Tool
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Select Tool Type</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`/${slug}/tools/create?type=sms`} prefetch={true}>SMS / Text Message</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/${slug}/tools/create?type=transfer_call`} prefetch={true}>Transfer Call</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/${slug}/tools/create?type=pipedream_action`} prefetch={true}>External App</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          {availableTools.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {assignedTools.length > 0
                ? 'All available tools are already assigned to this agent.'
                : 'No tools available. Create a tool to get started.'}
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availableTools.map((tool) => {
                    const toolDetails = getToolDetails(tool)
                    return (
                      <TableRow key={tool.id}>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center text-muted-foreground">
                            {getToolIcon(tool)}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          <Link 
                            href={`/${slug}/tools/${tool.id}`} 
                            className="hover:underline"
                            prefetch={true}
                          >
                            {tool.label || tool.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getToolBadgeColor(tool.type)}>
                            {getToolTypeDisplay(tool)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-md truncate">
                          {toolDetails || '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAssignTool(tool.id)}
                            disabled={assigningToolId === tool.id}
                          >
                            {assigningToolId === tool.id ? (
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
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

