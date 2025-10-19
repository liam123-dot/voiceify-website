import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAgentTools } from '@/lib/agent-tools'

type RouteContext = {
  params: Promise<{ slug: string; id: string }>
}

/**
 * GET /api/[slug]/agents/[id]/tools
 * 
 * Fetches all tools associated with an agent and returns them in LiveKit agent format.
 * Returns the tool definitions (name, description, parameters) without the execute function.
 * The agent implementation will provide the execute function based on the tool type.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const supabase = await createServiceClient()

  try {
    // Get the agent (no authentication required - this is called by LiveKit agents)
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .single()

    if (agentError || !agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Get tools using the reusable function
    const toolsResult = await getAgentTools(id)

    if (!toolsResult.success) {
      return NextResponse.json(
        { success: false, error: toolsResult.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      tools: toolsResult.tools,
      agent: {
        id: agent.id,
        name: agent.name,
      },
    })
  } catch (error) {
    console.error('Error in GET /api/[organizationId]/agents/[id]/tools:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}

