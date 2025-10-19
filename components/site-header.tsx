"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"

interface SiteHeaderProps {
  slug?: string
  isAdmin?: boolean
}

export function SiteHeader({ slug, isAdmin }: SiteHeaderProps) {
  const pathname = usePathname()
  const [agentNames, setAgentNames] = useState<Record<string, string>>({})
  const [toolNames, setToolNames] = useState<Record<string, string>>({})
  const [knowledgeBaseNames, setKnowledgeBaseNames] = useState<Record<string, string>>({})
  const [evaluationNames, setEvaluationNames] = useState<Record<string, string>>({})
  const [loadingAgents, setLoadingAgents] = useState<Record<string, boolean>>({})
  const [loadingTools, setLoadingTools] = useState<Record<string, boolean>>({})
  const [loadingKnowledgeBases, setLoadingKnowledgeBases] = useState<Record<string, boolean>>({})
  const [loadingEvaluations, setLoadingEvaluations] = useState<Record<string, boolean>>({})

  // Check if we should show the admin button
  const showAdminButton = isAdmin && !pathname.startsWith('/admin')

  // Fetch agent or tool name if we're on their detail pages
  useEffect(() => {
    const segments = pathname.split('/').filter(Boolean)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    
    // Check if we're on an agent detail page (e.g., /app/agents/[id])
    if (segments.length >= 3 && segments[1] === 'agents') {
      const agentId = segments[2]
      
      if (uuidRegex.test(agentId) && !agentNames[agentId] && !loadingAgents[agentId]) {
        // Set loading state
        setLoadingAgents(prev => ({ ...prev, [agentId]: true }))
        
        // Fetch the agent name
        fetch(`/api/${slug}/agents/${agentId}`)
          .then(res => res.json())
          .then(data => {
            if (data.agent) {
              setAgentNames(prev => ({ ...prev, [agentId]: data.agent.name }))
            }
            setLoadingAgents(prev => ({ ...prev, [agentId]: false }))
          })
          .catch(err => {
            console.error('Error fetching agent:', err)
            setLoadingAgents(prev => ({ ...prev, [agentId]: false }))
          })
      }
    }
    
    // Check if we're on a tool detail page (e.g., /[slug]/tools/[id])
    if (segments.length >= 3 && segments[1] === 'tools' && slug) {
      const toolId = segments[2]

      if (uuidRegex.test(toolId) && !toolNames[toolId] && !loadingTools[toolId]) {
        // Set loading state
        setLoadingTools(prev => ({ ...prev, [toolId]: true }))

        // Fetch the tool name using organization-scoped endpoint
        fetch(`/api/${slug}/tools/${toolId}`)
          .then(res => res.json())
          .then(data => {
            if (data.tool) {
              setToolNames(prev => ({ ...prev, [toolId]: data.tool.label || data.tool.name }))
            }
            setLoadingTools(prev => ({ ...prev, [toolId]: false }))
          })
          .catch(err => {
            console.error('Error fetching tool:', err)
            setLoadingTools(prev => ({ ...prev, [toolId]: false }))
          })
      }
    }
    
    // Check if we're on a knowledge base detail page (e.g., /[slug]/knowledge-base/[id])
    if (segments.length >= 3 && segments[1] === 'knowledge-base' && slug) {
      const kbId = segments[2]

      if (uuidRegex.test(kbId) && !knowledgeBaseNames[kbId] && !loadingKnowledgeBases[kbId]) {
        // Set loading state
        setLoadingKnowledgeBases(prev => ({ ...prev, [kbId]: true }))

        // Fetch the knowledge base name
        fetch(`/api/${slug}/knowledge-bases/${kbId}`)
          .then(res => res.json())
          .then(data => {
            if (data.knowledgeBase) {
              setKnowledgeBaseNames(prev => ({ ...prev, [kbId]: data.knowledgeBase.name }))
            }
            setLoadingKnowledgeBases(prev => ({ ...prev, [kbId]: false }))
          })
          .catch(err => {
            console.error('Error fetching knowledge base:', err)
            setLoadingKnowledgeBases(prev => ({ ...prev, [kbId]: false }))
          })
      }
    }
    
    // Check if we're on an evaluation detail page (e.g., /[slug]/evaluations/[id])
    if (segments.length >= 3 && segments[1] === 'evaluations' && slug) {
      const evaluationId = segments[2]

      if (uuidRegex.test(evaluationId) && !evaluationNames[evaluationId] && !loadingEvaluations[evaluationId]) {
        // Set loading state
        setLoadingEvaluations(prev => ({ ...prev, [evaluationId]: true }))

        // Fetch the evaluation name
        fetch(`/api/${slug}/evaluations/${evaluationId}`)
          .then(res => res.json())
          .then(data => {
            if (data.evaluation) {
              setEvaluationNames(prev => ({ ...prev, [evaluationId]: data.evaluation.name }))
            }
            setLoadingEvaluations(prev => ({ ...prev, [evaluationId]: false }))
          })
          .catch(err => {
            console.error('Error fetching evaluation:', err)
            setLoadingEvaluations(prev => ({ ...prev, [evaluationId]: false }))
          })
      }
    }
  }, [pathname, agentNames, toolNames, knowledgeBaseNames, evaluationNames, loadingAgents, loadingTools, loadingKnowledgeBases, loadingEvaluations, slug])

  // Generate breadcrumb items from pathname
  const getBreadcrumbItems = (path: string) => {
    const segments = path.split('/').filter(Boolean)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const items: { label: string; href: string; isLast: boolean; isLoading: boolean }[] = []

    // If we're on the home page
    if (segments.length === 0 || (segments.length === 1 && segments[0] === 'app')) {
      return [{ label: 'Home', href: '/app', isLast: true, isLoading: false }]
    }

    // Build breadcrumb items
    let currentPath = ''
    segments.forEach((segment, index) => {
      currentPath += `/${segment}`
      const isLast = index === segments.length - 1
      let isLoading = false

      // Format label
      let label = segment.charAt(0).toUpperCase() + segment.slice(1)
      
      // Replace dashes with spaces and capitalize each word
      label = label.replace(/-/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
      
      // Special cases
      if (segment === 'app') {
        label = 'Home'
      }
      
      // Check if this is an agent ID
      if (segments[index - 1] === 'agents' && uuidRegex.test(segment)) {
        if (agentNames[segment]) {
          label = agentNames[segment]
        } else if (loadingAgents[segment]) {
          isLoading = true
          label = '' // Will be replaced by skeleton
        }
      }
      
      // Check if this is a tool ID
      if (segments[index - 1] === 'tools' && uuidRegex.test(segment)) {
        if (toolNames[segment]) {
          label = toolNames[segment]
        } else if (loadingTools[segment]) {
          isLoading = true
          label = '' // Will be replaced by skeleton
        }
      }
      
      // Check if this is a knowledge base ID
      if (segments[index - 1] === 'knowledge-base' && uuidRegex.test(segment)) {
        if (knowledgeBaseNames[segment]) {
          label = knowledgeBaseNames[segment]
        } else if (loadingKnowledgeBases[segment]) {
          isLoading = true
          label = '' // Will be replaced by skeleton
        }
      }
      
      // Check if this is an evaluation ID
      if (segments[index - 1] === 'evaluations' && uuidRegex.test(segment)) {
        if (evaluationNames[segment]) {
          label = evaluationNames[segment]
        } else if (loadingEvaluations[segment]) {
          isLoading = true
          label = '' // Will be replaced by skeleton
        }
      }

      items.push({
        label,
        href: currentPath,
        isLast,
        isLoading,
      })
    })

    return items
  }

  const breadcrumbItems = getBreadcrumbItems(pathname)

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbItems.map((item) => (
              <div key={item.href} className="flex items-center gap-1 lg:gap-2">
                <BreadcrumbItem>
                  {item.isLoading ? (
                    <Skeleton className="h-4 w-24" />
                  ) : item.isLast ? (
                    <BreadcrumbPage>{item.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={item.href}>{item.label}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {!item.isLast && <BreadcrumbSeparator />}
              </div>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
        {showAdminButton && (
          <div className="ml-auto">
            <Link href="/admin">
              <Button variant="outline" size="sm">
                Admin Dashboard
              </Button>
            </Link>
          </div>
        )}
      </div>
    </header>
  )
}
