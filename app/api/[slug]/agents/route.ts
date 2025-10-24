import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Type definitions for agent relationships
interface Tool {
  id: string
  label: string | null
  name: string
}

interface AgentToolRecord {
  tools: Tool
}

interface KnowledgeBase {
  id: string
  name: string
}

interface AgentKnowledgeBaseRecord {
  knowledge_bases: KnowledgeBase
}

interface PhoneNumber {
  id: string
  phone_number: string
}

interface AgentRow {
  id: string
  name: string
  created_at: string
  agent_tools: AgentToolRecord[]
  agent_knowledge_bases: AgentKnowledgeBaseRecord[]
  phone_numbers: PhoneNumber[]
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const { user, organizationId } = await getAuthSession(slug)

    if (!user || !organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createServiceClient()

    // Fetch agents with related data
    const { data: agents } = (await supabase
      .from('agents')
      .select(`
        id, 
        name, 
        created_at,
        agent_tools(
          tools(id, label, name)
        ),
        agent_knowledge_bases(
          knowledge_bases(id, name)
        ),
        phone_numbers(id, phone_number)
      `)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })) as {
        data: AgentRow[] | null
      }

    // Transform the data to include details
    const agentsWithDetails = (agents || []).map((agent: AgentRow) => {
      const tools = (agent.agent_tools || [])
        .filter((at: AgentToolRecord) => at.tools)
        .map((at: AgentToolRecord) => {
          const tool = at.tools
          return {
            id: tool.id,
            name: tool.label || tool.name,
          }
        })
      
      const knowledgeBases = (agent.agent_knowledge_bases || [])
        .filter((akb: AgentKnowledgeBaseRecord) => akb.knowledge_bases)
        .map((akb: AgentKnowledgeBaseRecord) => {
          const kb = akb.knowledge_bases
          return {
            id: kb.id,
            name: kb.name,
          }
        })
      
      const phoneNumbers = (agent.phone_numbers || [])
        .filter(Boolean)
        .map((pn: PhoneNumber) => ({
          id: pn.id,
          number: pn.phone_number,
        }))
      
      return {
        id: agent.id,
        name: agent.name,
        created_at: agent.created_at,
        tools,
        knowledge_bases: knowledgeBases,
        phone_numbers: phoneNumbers,
      }
    })

    return NextResponse.json({ agents: agentsWithDetails })
  } catch (error) {
    console.error('Error in GET /api/[slug]/agents:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const { user, organizationId } = await getAuthSession(slug)

    if (!user || !organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const supabase = await createServiceClient()

    const { data: agent, error: createError } = await supabase
      .from('agents')
      .insert({
        name: body.name,
        organization_id: organizationId,
      })
      .select('id, name')
      .single()

    if (createError) {
      console.error('Error creating agent:', createError)
      return NextResponse.json({ error: 'Failed to create agent' }, { status: 400 })
    }

    return NextResponse.json({ agent })
  } catch (error) {
    console.error('Error in POST /api/[slug]/agents:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
