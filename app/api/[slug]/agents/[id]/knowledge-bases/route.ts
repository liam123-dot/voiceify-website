import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{ slug: string; id: string }>
}

type KnowledgeBase = {
  id: string
  name: string
  description: string | null
  created_at: string
}

type AgentKnowledgeBase = {
  id: string
  knowledge_base_id: string
  knowledge_bases: KnowledgeBase
}

/**
 * GET /api/[slug]/agents/[id]/knowledge-bases
 * 
 * Returns all knowledge bases assigned to an agent
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

    // Fetch assigned knowledge bases
    const { data: agentKnowledgeBases, error: fetchError } = await supabase
      .from('agent_knowledge_bases')
      .select(`
        id,
        knowledge_base_id,
        knowledge_bases (
          id,
          name,
          description,
          created_at
        )
      `)
      .eq('agent_id', agentId) as { data: AgentKnowledgeBase[] | null; error: Error | null }

      if (!agentKnowledgeBases) {
        return NextResponse.json(
          { success: false, error: 'No knowledge bases found' },
          { status: 404 }
        )
      }

    if (fetchError) {
      console.error('Error fetching agent knowledge bases:', fetchError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch knowledge bases' },
        { status: 500 }
      )
    }

    // Transform the data to flatten the structure
    const knowledgeBases = agentKnowledgeBases.map((akb: AgentKnowledgeBase) => {
      return {
        id: akb.knowledge_bases.id,
        name: akb.knowledge_bases.name,
        description: akb.knowledge_bases.description,
        created_at: akb.knowledge_bases.created_at,
      }
    })

    return NextResponse.json({
      success: true,
      knowledgeBases,
    })
  } catch (error) {
    console.error('Error in GET /api/[slug]/agents/[id]/knowledge-bases:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}

