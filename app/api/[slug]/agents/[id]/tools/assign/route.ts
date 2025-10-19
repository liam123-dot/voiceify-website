import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthSession } from '@/lib/auth'

type RouteContext = {
  params: Promise<{ slug: string; id: string }>
}

/**
 * POST /api/[slug]/agents/[id]/tools/assign
 * 
 * Assigns a tool to an agent by creating a record in the agent_tools linking table.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { slug, id: agentId } = await context.params

  try {
    const { user, organizationId } = await getAuthSession(slug)

    if (!user || !organizationId) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated or unauthorized' },
        { status: 401 }
      )
    }

    const supabase = await createClient()

    // Verify agent exists and belongs to user's organization
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id')
      .eq('id', agentId)
      .eq('organization_id', organizationId)
      .single()

    if (agentError || !agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Get tool ID from request body
    const body = await request.json()
    const { toolId } = body

    if (!toolId) {
      return NextResponse.json(
        { success: false, error: 'Tool ID is required' },
        { status: 400 }
      )
    }

    // Verify tool exists and belongs to user's organization
    const { data: tool, error: toolError } = await supabase
      .from('tools')
      .select('id')
      .eq('id', toolId)
      .eq('organization_id', organizationId)
      .single()

    if (toolError || !tool) {
      return NextResponse.json(
        { success: false, error: 'Tool not found' },
        { status: 404 }
      )
    }

    // Assign tool to agent (upsert to handle existing assignments gracefully)
    const { data: agentTool, error: assignError } = await supabase
      .from('agent_tools')
      .upsert(
        {
          agent_id: agentId,
          tool_id: toolId,
        },
        {
          onConflict: 'agent_id,tool_id',
        }
      )
      .select()
      .single()

    if (assignError) {
      console.error('Error assigning tool:', assignError)
      return NextResponse.json(
        { success: false, error: 'Failed to assign tool' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      agentTool,
    })
  } catch (error) {
    console.error('Error in POST /api/[organizationId]/agents/[id]/tools/assign:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}

