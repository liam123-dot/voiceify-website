import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{ slug: string; id: string }>
}

type Evaluation = {
  id: string
  name: string
  description: string | null
  created_at: string
}

type AgentEvaluation = {
  id: string
  evaluation_id: string
  evaluations: Evaluation
}

/**
 * GET /api/[slug]/agents/[id]/evaluations
 * 
 * Returns all evaluations assigned to an agent
 */
export async function GET(request: Request, context: RouteContext) {
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

    // Fetch assigned evaluations
    const { data: agentEvaluations, error: fetchError } = await supabase
      .from('agent_evaluations')
      .select(`
        id,
        evaluation_id,
        evaluations (
          id,
          name,
          description,
          created_at
        )
      `)
      .eq('agent_id', agentId) as { data: AgentEvaluation[] | null; error: Error | null }

      if (!agentEvaluations) {
        return NextResponse.json(
          { success: false, error: 'No evaluations found' },
          { status: 404 }
        )
      }

    if (fetchError) {
      console.error('Error fetching agent evaluations:', fetchError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch evaluations' },
        { status: 500 }
      )
    }

    // Transform the data to flatten the structure
    const evaluations = agentEvaluations.map((ae: AgentEvaluation) => {
      return {
        id: ae.evaluations.id,
        name: ae.evaluations.name,
        description: ae.evaluations.description,
        created_at: ae.evaluations.created_at,
      }
    })

    return NextResponse.json({
      success: true,
      evaluations,
    })
  } catch (error) {
    console.error('Error in GET /api/[slug]/agents/[id]/evaluations:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}

