'use client'

import { useState, useEffect } from "react"
import { IconTool } from "@tabler/icons-react"
import Link from "next/link"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { ToolsGrid } from "@/app/(dashboard)/[slug]/tools/tools-grid"

type ToolsListProps = {
  slug: string
}

type Tool = {
  id: string
  name: string
  label: string | null
  description: string | null
  type: string | null
  config_metadata: {
    pipedreamMetadata?: {
      appImgSrc?: string
      appName?: string
    }
  } | null
  created_at: string
}

export function ToolsList({ slug }: ToolsListProps) {
  const [tools, setTools] = useState<Tool[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchTools = async () => {
      try {
        setIsLoading(true)
        const response = await fetch(`/api/${slug}/tools`)
        const data = await response.json()

        if (data.success && data.tools) {
          setTools((data.tools || []) as Tool[])
        } else {
          setTools([])
        }
      } catch (error) {
        console.error('Error fetching tools:', error)
        setTools([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchTools()
  }, [slug])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-sm text-muted-foreground">Loading tools...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {tools.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconTool />
            </EmptyMedia>
            <EmptyTitle>No Tools Yet</EmptyTitle>
            <EmptyDescription>
              You haven&apos;t created any tools yet. Get started by creating
              your first tool integration.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Tool
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-56">
                <DropdownMenuLabel>Select Tool Type</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`/${slug}/tools/create?type=sms`}>SMS / Text Message</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/${slug}/tools/create?type=transfer_call`}>Transfer Call</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/${slug}/tools/create?type=pipedream_action`}>External App</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {tools.length} {tools.length === 1 ? 'tool' : 'tools'}
            </p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Tool
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Select Tool Type</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`/${slug}/tools/create?type=sms`}>SMS / Text Message</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/${slug}/tools/create?type=transfer_call`}>Transfer Call</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/${slug}/tools/create?type=pipedream_action`}>External App</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <ToolsGrid tools={tools} slug={slug} />
        </div>
      )}
    </div>
  )
}
