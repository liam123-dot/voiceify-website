import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthSession } from '@/lib/auth'

type RouteContext = {
  params: Promise<{ slug: string; id: string }>
}

/**
 * DELETE /api/[slug]/agents/[id]/knowledge-bases/unassign
 * 
 * Unassigns a knowledge base from an agent by deleting the record in the agent_knowledge_bases linking table.
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

    // Get knowledge base ID from request body
    const body = await request.json()
    const { knowledgeBaseId } = body

    if (!knowledgeBaseId) {
      return NextResponse.json(
        { success: false, error: 'Knowledge base ID is required' },
        { status: 400 }
      )
    }

    // Unassign knowledge base from agent
    const { error: unassignError } = await supabase
      .from('agent_knowledge_bases')
      .delete()
      .eq('agent_id', agentId)
      .eq('knowledge_base_id', knowledgeBaseId)

    if (unassignError) {
      console.error('Error unassigning knowledge base:', unassignError)
      return NextResponse.json(
        { success: false, error: 'Failed to unassign knowledge base' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('Error in DELETE /api/[slug]/agents/[id]/knowledge-bases/unassign:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}

