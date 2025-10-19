import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import ragie from '@/lib/ragie/client'

export const dynamic = 'force-dynamic'

// POST - Retrieve relevant documents from agent's assigned knowledge bases
// No authentication required - can be called by agents or other services
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { query, topK = 10, rerank = true } = await request.json()

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    const { id: agentId } = await params
    const supabase = await createServiceClient()

    // Fetch the agent and its organization
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, organization_id')
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const organizationId = agent.organization_id

    // Fetch all knowledge bases assigned to this agent
    const { data: agentKnowledgeBases, error: kbError } = await supabase
      .from('agent_knowledge_bases')
      .select('knowledge_base_id')
      .eq('agent_id', agentId)

    if (kbError) {
      console.error('Error fetching agent knowledge bases:', kbError)
      return NextResponse.json({ error: 'Failed to fetch agent knowledge bases' }, { status: 500 })
    }

    // Extract knowledge base IDs
    const kbIdsToSearch = (agentKnowledgeBases || []).map(akb => akb.knowledge_base_id)

    // If no knowledge bases are assigned, return empty results
    if (kbIdsToSearch.length === 0) {
      return NextResponse.json({
        query,
        knowledgeBaseIds: [],
        scoredChunks: [],
        message: 'No knowledge bases assigned to this agent',
      })
    }

    // Build metadata filter for knowledge base IDs
    const filter: Record<string, unknown> = {}
    if (kbIdsToSearch.length === 1) {
      filter.knowledge_base_id = kbIdsToSearch[0]
    } else {
      filter.knowledge_base_id = { $in: kbIdsToSearch }
    }

    console.log('filter', filter)

    // Retrieve from Ragie using organization partition and knowledge base metadata filter
    try {
      const retrievalResponse = await ragie.retrievals.retrieve({
        query: query.trim(),
        partition: organizationId,
        filter,
        // topK,
        // rerank,
      })

      // Extract just the text from each scored chunk
      const context = (retrievalResponse.scoredChunks || []).map(chunk => chunk.text)

      return NextResponse.json({
        // query,
        // knowledgeBaseIds: kbIdsToSearch,
        context,
      })
    } catch (ragieError) {
      console.error('Error retrieving from Ragie:', ragieError)
      return NextResponse.json(
        { error: 'Failed to retrieve documents. The knowledge base may not have any indexed documents yet.' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error in POST /api/agents/[id]/retrieve:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

