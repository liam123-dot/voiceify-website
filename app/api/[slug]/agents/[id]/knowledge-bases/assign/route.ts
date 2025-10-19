import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthSession } from '@/lib/auth'

type RouteContext = {
  params: Promise<{ slug: string; id: string }>
}

/**
 * POST /api/[slug]/agents/[id]/knowledge-bases/assign
 * 
 * Assigns a knowledge base to an agent by creating a record in the agent_knowledge_bases linking table.
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

    // Get knowledge base ID from request body
    const body = await request.json()
    const { knowledgeBaseId } = body

    if (!knowledgeBaseId) {
      return NextResponse.json(
        { success: false, error: 'Knowledge base ID is required' },
        { status: 400 }
      )
    }

    // Verify knowledge base exists and belongs to user's organization
    const { data: knowledgeBase, error: kbError } = await supabase
      .from('knowledge_bases')
      .select('id')
      .eq('id', knowledgeBaseId)
      .eq('organization_id', organizationId)
      .single()

    if (kbError || !knowledgeBase) {
      return NextResponse.json(
        { success: false, error: 'Knowledge base not found' },
        { status: 404 }
      )
    }

    // Assign knowledge base to agent (upsert to handle existing assignments gracefully)
    const { data: agentKnowledgeBase, error: assignError } = await supabase
      .from('agent_knowledge_bases')
      .upsert(
        {
          agent_id: agentId,
          knowledge_base_id: knowledgeBaseId,
        },
        {
          onConflict: 'agent_id,knowledge_base_id',
        }
      )
      .select()
      .single()

    if (assignError) {
      console.error('Error assigning knowledge base:', assignError)
      return NextResponse.json(
        { success: false, error: 'Failed to assign knowledge base' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      agentKnowledgeBase,
    })
  } catch (error) {
    console.error('Error in POST /api/[slug]/agents/[id]/knowledge-bases/assign:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}

