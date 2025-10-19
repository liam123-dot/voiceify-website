import { IconTool } from "@tabler/icons-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getAuthSession } from "@/lib/auth"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CredentialsList } from "@/components/credentials/credentials-list"
import { ToolsGrid } from "./tools-grid"

type ToolsPageProps = {
  params: Promise<{ slug: string }>
}

export default async function ToolsPage({ params }: ToolsPageProps) {
  const { slug } = await params
  const { user, organizationId } = await getAuthSession(slug)

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

  let tools: (Tool & { slug: string })[] = []

  if (user && organizationId) {
    const supabase = await createClient()
    
    // Fetch tools
    const { data } = await supabase
      .from('tools')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    tools = ((data || []) as Tool[]).map(tool => ({ ...tool, slug }))
  }

  return (
    <div className="px-4 lg:px-6">
      <Tabs defaultValue="tools" className="w-full space-y-6">
        <TabsList>
          <TabsTrigger value="tools">Tools</TabsTrigger>
          <TabsTrigger value="credentials">Credentials</TabsTrigger>
        </TabsList>

        <TabsContent value="tools" className="space-y-4">
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
        </TabsContent>

        <TabsContent value="credentials" className="space-y-4">
          <CredentialsList slug={slug} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

