import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthSession } from '@/lib/auth'

type RouteContext = {
  params: Promise<{ slug: string; id: string }>
}

/**
 * POST /api/[slug]/agents/[id]/evaluations/assign
 * 
 * Assigns an evaluation to an agent by creating a record in the agent_evaluations linking table.
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

    // Verify evaluation exists and belongs to user's organization
    const { data: evaluation, error: evalError } = await supabase
      .from('evaluations')
      .select('id')
      .eq('id', evaluationId)
      .eq('organization_id', organizationId)
      .single()

    if (evalError || !evaluation) {
      return NextResponse.json(
        { success: false, error: 'Evaluation not found' },
        { status: 404 }
      )
    }

    // Assign evaluation to agent (upsert to handle existing assignments gracefully)
    const { data: agentEvaluation, error: assignError } = await supabase
      .from('agent_evaluations')
      .upsert(
        {
          agent_id: agentId,
          evaluation_id: evaluationId,
        },
        {
          onConflict: 'agent_id,evaluation_id',
        }
      )
      .select()
      .single()

    if (assignError) {
      console.error('Error assigning evaluation:', assignError)
      return NextResponse.json(
        { success: false, error: 'Failed to assign evaluation' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      agentEvaluation,
    })
  } catch (error) {
    console.error('Error in POST /api/[slug]/agents/[id]/evaluations/assign:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}

