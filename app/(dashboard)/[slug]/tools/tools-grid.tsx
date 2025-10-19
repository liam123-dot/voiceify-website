'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MessageSquare, PhoneForwarded, Code2, Trash2, Loader2, Mail } from 'lucide-react'
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
import { type ToolCardData } from '@/components/tools/tool-card'

interface ToolsGridProps {
  tools: ToolCardData[]
  slug: string
}

interface AgentInfo {
  id: string
  name: string
}

interface ToolWithAgents extends ToolCardData {
  agents: AgentInfo[]
}

function getToolIcon(tool: ToolWithAgents) {
  const metadata = tool.config_metadata as Record<string, unknown>

  const pipedreamMetadata = metadata.pipedreamMetadata as Record<string, unknown> | undefined
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

function getToolBadgeColor(type?: string | null) {
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

function formatToolType(type?: string | null) {
  if (!type) return 'Unknown'
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function getDisplayName(tool: ToolWithAgents): string {
  return tool.label || tool.name
}

function getToolTypeDisplay(tool: ToolWithAgents): string {
  if (tool.type === 'pipedream_action') {
    const metadata = tool.config_metadata as Record<string, unknown>
    const pipedreamMetadata = metadata.pipedreamMetadata as Record<string, unknown> | undefined
    return (pipedreamMetadata?.appName as string) || 'External App'
  }
  return formatToolType(tool.type)
}

function getToolDetails(tool: ToolWithAgents): string | null {
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

export function ToolsGrid({ tools: initialTools, slug }: ToolsGridProps) {
  const router = useRouter()
  const [deletingToolId, setDeletingToolId] = useState<string | null>(null)
  const [toolToDelete, setToolToDelete] = useState<string | null>(null)
  const [toolsWithAgents, setToolsWithAgents] = useState<ToolWithAgents[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Tools already come with agents from the API
    const enhancedTools = initialTools.map((tool: ToolCardData & { agents?: AgentInfo[] }) => ({
      ...tool,
      agents: tool.agents || [],
    }))
    setToolsWithAgents(enhancedTools)
  }, [initialTools])

  const handleDeleteTool = async (toolId: string) => {
    try {
      setDeletingToolId(toolId)

      const response = await fetch(`/api/${slug}/tools/${toolId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!data.success) {
        toast.error(data.error || 'Failed to delete tool')
        return
      }

      toast.success('Tool deleted successfully')
      router.refresh()
    } catch (error) {
      console.error('Error deleting tool:', error)
      toast.error('Failed to delete tool')
    } finally {
      setDeletingToolId(null)
      setToolToDelete(null)
    }
  }

  return (
    <>
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12"></TableHead>
              <TableHead className="font-semibold">Name</TableHead>
              <TableHead className="font-semibold">Type</TableHead>
              <TableHead className="font-semibold">Details</TableHead>
              <TableHead className="font-semibold">Agents</TableHead>
              <TableHead className="text-right font-semibold w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : toolsWithAgents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No tools yet
                </TableCell>
              </TableRow>
            ) : (
              toolsWithAgents.map((tool) => {
                const toolDetails = getToolDetails(tool)
                const agentCount = tool.agents.length

                return (
                  <TableRow
                    key={tool.id}
                    className="hover:bg-muted/30 cursor-pointer group"
                    onClick={() => router.push(`/${slug}/tools/${tool.id}`)}
                  >
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center text-muted-foreground">
                        {getToolIcon(tool)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{getDisplayName(tool)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getToolBadgeColor(tool.type)}>
                        {getToolTypeDisplay(tool)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {toolDetails ? (
                        <span className="text-sm text-muted-foreground">
                          {toolDetails}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground opacity-50">
                          -
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {agentCount === 0 ? (
                          <span className="text-sm text-muted-foreground opacity-50">
                            No agents
                          </span>
                        ) : agentCount <= 2 ? (
                          tool.agents.map((agent) => (
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
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        disabled={deletingToolId === tool.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          setToolToDelete(tool.id)
                        }}
                      >
                        {deletingToolId === tool.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={toolToDelete !== null} onOpenChange={() => setToolToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tool</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this tool? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toolToDelete && handleDeleteTool(toolToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

