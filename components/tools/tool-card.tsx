'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { MessageSquare, PhoneForwarded, Code2, Pencil, Trash2, X, Loader2, Plus, LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface ToolCardData {
  id: string
  name: string
  label: string | null
  type: string | null
  description: string | null
  slug?: string
  config_metadata?: {
    pipedreamMetadata?: {
      appImgSrc?: string
      appName?: string
    }
  } | Record<string, unknown> | null
  created_at?: string
}

interface ToolCardProps {
  tool: ToolCardData
  variant?: 'default' | 'assigned'
  showEdit?: boolean
  showDelete?: boolean
  showAdd?: boolean
  deleteLabel?: string
  deleteIcon?: 'trash' | 'x'
  onDelete?: (toolId: string) => void | Promise<void>
  onAdd?: (toolId: string) => void | Promise<void>
  isDeleting?: boolean
  isAdding?: boolean
  showCreatedDate?: boolean
  clickable?: boolean
  className?: string
}

export function ToolCard({
  tool,
  showEdit = false,
  showDelete = false,
  showAdd = false,
  deleteLabel = 'Remove',
  deleteIcon = 'trash',
  onDelete,
  onAdd,
  isDeleting = false,
  isAdding = false,
  showCreatedDate = false,
  clickable = false,
  className,
}: ToolCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  // Get app info first since it's used in other functions
  const getAppInfo = () => {
    if (tool.type === 'pipedream_action' && tool.config_metadata) {
      const metadata = tool.config_metadata as {
        pipedreamMetadata?: {
          appName?: string
          appImgSrc?: string
        }
      }
      if (metadata.pipedreamMetadata) {
        return {
          appName: metadata.pipedreamMetadata.appName,
          appImgSrc: metadata.pipedreamMetadata.appImgSrc,
        }
      }
    }
    return null
  }

  const appInfo = getAppInfo()

  // Get transfer call details
  const getTransferDetails = () => {
    if (tool.type === 'transfer_call' && tool.config_metadata) {
      const metadata = tool.config_metadata as {
        target?: {
          type: 'agent' | 'number'
          agentName?: string
          phoneNumber?: string
        }
      }
      if (metadata.target) {
        if (metadata.target.type === 'agent' && metadata.target.agentName) {
          return {
            type: 'agent',
            value: metadata.target.agentName,
          }
        } else if (metadata.target.type === 'number' && metadata.target.phoneNumber) {
          return {
            type: 'number',
            value: metadata.target.phoneNumber,
          }
        }
      }
    }
    return null
  }

  const transferDetails = getTransferDetails()

  const getToolTypeName = (type: string | null) => {
    if (!type) return 'Unknown'
    switch (type) {
      case 'sms':
        return 'SMS / Text Message'
      case 'transfer_call':
        return 'Transfer Call'
      case 'api_request':
        return 'API Request'
      case 'pipedream_action':
        // For pipedream actions, show the app name if available
        if (appInfo?.appName) {
          return appInfo.appName
        }
        return 'External App'
      default:
        return type
    }
  }

  const getToolIcon = (): { Icon: LucideIcon; color: string } => {
    switch (tool.type) {
      case 'sms':
        return { Icon: MessageSquare, color: 'text-blue-600' }
      case 'transfer_call':
        return { Icon: PhoneForwarded, color: 'text-green-600' }
      case 'api_request':
        return { Icon: Code2, color: 'text-purple-600' }
      case 'pipedream_action':
        return { Icon: Code2, color: 'text-orange-600' }
      default:
        return { Icon: Code2, color: 'text-gray-600' }
    }
  }

  const displayLabel = tool.label || tool.name
  const DeleteIcon = deleteIcon === 'trash' ? Trash2 : X
  const { Icon: ToolIcon, color: iconColor } = getToolIcon()

  const handleDelete = async () => {
    if (!onDelete) return

    if (deleteIcon === 'trash') {
      // Show confirmation dialog for destructive actions
      setShowDeleteDialog(true)
    } else {
      // Direct action for unassign (X icon)
      setIsProcessing(true)
      try {
        await onDelete(tool.id)
      } finally {
        setIsProcessing(false)
      }
    }
  }

  const handleConfirmDelete = async () => {
    if (!onDelete) return
    
    setIsProcessing(true)
    try {
      await onDelete(tool.id)
      setShowDeleteDialog(false)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleAdd = async () => {
    if (!onAdd) return
    
    await onAdd(tool.id)
  }

  const cardContent = (
    <Card
      className={cn(
        'relative overflow-hidden transition-all duration-200 h-full',
        clickable && 'hover:border-primary hover:shadow-md cursor-pointer',
        className
      )}
    >
          <CardHeader className="pb-3">
            <div className="flex items-start gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="mt-0.5 flex-shrink-0">
                  {appInfo?.appImgSrc ? (
                    <div className="p-2 rounded-lg bg-muted border">
                      <Image
                        src={appInfo.appImgSrc}
                        alt={appInfo.appName || 'App'}
                        width={20}
                        height={20}
                      />
                    </div>
                  ) : (
                    <div className={cn('p-2 rounded-lg', 
                      tool.type === 'sms' && 'bg-blue-100 dark:bg-blue-950',
                      tool.type === 'transfer_call' && 'bg-green-100 dark:bg-green-950',
                      tool.type === 'api_request' && 'bg-purple-100 dark:bg-purple-950',
                      tool.type === 'pipedream_action' && 'bg-orange-100 dark:bg-orange-950',
                      !tool.type && 'bg-gray-100 dark:bg-gray-950'
                    )}>
                      <ToolIcon className={cn('size-5', iconColor)} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <CardTitle className="text-base font-semibold leading-tight truncate">
                    {displayLabel}
                  </CardTitle>
                  <CardDescription className="flex flex-col gap-0.5 mt-1">
                    <span className="text-xs truncate">{getToolTypeName(tool.type)}</span>
                    {transferDetails && (
                      <span className="text-xs text-muted-foreground/80 truncate">
                        {transferDetails.type === 'agent' 
                          ? `→ Agent: ${transferDetails.value}`
                          : `→ Number: ${transferDetails.value}`
                        }
                      </span>
                    )}
                  </CardDescription>
                </div>
              </div>

              {(showEdit || showDelete || showAdd) && (
                <div className="flex items-start gap-0.5 flex-shrink-0 pt-0.5">
                  {showAdd && onAdd && (
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleAdd()
                      }}
                      disabled={isAdding}
                      className="h-7 w-7 p-0 rounded-md shadow-sm"
                    >
                      {isAdding ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                      <span className="sr-only">Assign</span>
                    </Button>
                  )}
                  {showEdit && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      asChild
                      className="h-7 w-7 p-0 hover:bg-muted"
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    >
                      <Link href={`/${tool.slug}/tools/${tool.id}`}>
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="sr-only">Edit</span>
                      </Link>
                    </Button>
                  )}
                  {showDelete && onDelete && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleDelete()
                      }}
                      disabled={isDeleting || isProcessing}
                      className={cn(
                        'h-7 w-7 p-0',
                        deleteIcon === 'trash'
                          ? 'hover:bg-destructive/10 hover:text-destructive'
                          : 'hover:bg-muted hover:text-destructive'
                      )}
                    >
                      {isDeleting || isProcessing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <DeleteIcon className="h-3.5 w-3.5" />
                      )}
                      <span className="sr-only">{deleteLabel}</span>
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardHeader>

          {(tool.description || showCreatedDate) && (
            <CardContent className="pt-0 space-y-2">
              {tool.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                  {tool.description}
                </p>
              )}
              {showCreatedDate && tool.created_at && (
                <p className="text-xs text-muted-foreground">
                  Created {new Date(tool.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              )}
            </CardContent>
          )}
    </Card>
  )

  return (
    <>
      {clickable ? (
        <Link href={`/${tool.slug}/tools/${tool.id}`}>
          {cardContent}
        </Link>
      ) : (
        cardContent
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tool</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{displayLabel}&quot;? This action cannot be
              undone and will remove the tool from all agents using it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmDelete()
              }}
              disabled={isProcessing}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Tool'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

