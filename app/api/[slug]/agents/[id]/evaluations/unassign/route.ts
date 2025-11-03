import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthSession } from '@/lib/auth'

type RouteContext = {
  params: Promise<{ slug: string; id: string }>
}

/**
 * DELETE /api/[slug]/agents/[id]/evaluations/unassign
 * 
 * Unassigns an evaluation from an agent by deleting the record in the agent_evaluations linking table.
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

    const supabase = await createServiceClient()

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

    // Get evaluation ID from request body
    const body = await request.json()
    const { evaluationId } = body

    if (!evaluationId) {
      return NextResponse.json(
        { success: false, error: 'Evaluation ID is required' },
        { status: 400 }
      )
    }

    // Unassign evaluation from agent
    const { error: unassignError } = await supabase
      .from('agent_evaluations')
      .delete()
      .eq('agent_id', agentId)
      .eq('evaluation_id', evaluationId)

    if (unassignError) {
      console.error('Error unassigning evaluation:', unassignError)
      return NextResponse.json(
        { success: false, error: 'Failed to unassign evaluation' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('Error in DELETE /api/[slug]/agents/[id]/evaluations/unassign:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}

