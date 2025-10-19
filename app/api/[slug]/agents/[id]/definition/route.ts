import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import type { AgentConfiguration } from "@/types/agent-config"
import { getAuthSession } from "@/lib/auth"

type RouteContext = {
  params: Promise<{ slug: string; id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { slug, id } = await context.params
    const { user, organizationId } = await getAuthSession(slug)

    if (!user || !organizationId) {
      return NextResponse.json(
        { error: 'Not authenticated or unauthorized' },
        { status: 401 }
      )
    }

    const supabase = await createServiceClient()

    // Fetch the agent configuration from the database
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('configuration')
      .eq('id', id)
      .single()

    if (agentError || !agent) {
      console.error('Agent not found:', agentError)
      return NextResponse.json(
        { error: 'Agent not found' }, 
        { status: 404 }
      )
    }

    // Parse configuration if it's a string
    const configuration = typeof agent.configuration === 'string'
      ? JSON.parse(agent.configuration)
      : agent.configuration

    // Return the agent configuration
    return NextResponse.json(configuration as AgentConfiguration)
  } catch (error) {
    console.error('Error in /api/[organizationId]/agents/[id]/definition GET:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

