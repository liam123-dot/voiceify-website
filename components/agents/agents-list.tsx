'use client'

import { useState, useEffect } from "react"
import { IconRobot } from "@tabler/icons-react"
import Link from "next/link"
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface Agent {
  id: string
  name: string
  created_at: string
}

interface AgentsListProps {
  slug: string
}

export function AgentsList({ slug }: AgentsListProps) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchAgents() {
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
    }

    fetchAgents()
  }, [slug])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5" />
                  <Skeleton className="h-5 w-32" />
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-40" />
              </CardContent>
            </Card>
          ))}
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
          <Button asChild>
            <Link href={`/${slug}/agents/create`} prefetch={true}>Create Agent</Link>
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {agents.length} {agents.length === 1 ? 'agent' : 'agents'}
        </p>
        <Button asChild>
          <Link href={`/${slug}/agents/create`} prefetch={true}>Create Agent</Link>
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => (
          <Link key={agent.id} href={`/${slug}/agents/${agent.id}`} prefetch={true}>
            <Card className="hover:border-primary transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconRobot className="size-5" />
                  {agent.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Created {new Date(agent.created_at).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

