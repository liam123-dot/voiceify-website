import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthSession } from '@/lib/auth'

type RouteContext = {
  params: Promise<{ slug: string; id: string }>
}

/**
 * DELETE /api/[slug]/agents/[id]/tools/unassign
 * 
 * Unassigns a tool from an agent by removing the record from the agent_tools linking table.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
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

    // Unassign tool from agent
    const { error: unassignError } = await supabase
      .from('agent_tools')
      .delete()
      .eq('agent_id', agentId)
      .eq('tool_id', toolId)

    if (unassignError) {
      console.error('Error unassigning tool:', unassignError)
      return NextResponse.json(
        { success: false, error: 'Failed to unassign tool' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('Error in DELETE /api/[organizationId]/agents/[id]/tools/unassign:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}

