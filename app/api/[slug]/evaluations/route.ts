import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET - List all evaluations for an organization
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { user, organizationId } = await getAuthSession()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { slug } = await params

    const supabase = await createServiceClient()

    // Verify the organization slug matches the user's organization
    const { data: org } = await supabase
      .from('organisations')
      .select('id')
      .eq('slug', slug)
      .eq('id', organizationId)
      .single()

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Fetch evaluations for the organization
    const { data: evaluations, error } = await supabase
      .from('evaluations')
      .select('id, name, description, prompt, model_provider, model_name, output_schema, created_at, updated_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching evaluations:', error)
      return NextResponse.json({ error: 'Failed to fetch evaluations' }, { status: 500 })
    }

    // Fetch agent assignments for all evaluations
    const evalIds = (evaluations || []).map(ev => ev.id)
    const { data: agentAssignments } = await supabase
      .from('agent_evaluations')
      .select('evaluation_id, agents!agent_id(id, name)')
      .in('evaluation_id', evalIds) as {
        data: Array<{
          evaluation_id: string
          agents: { id: string; name: string } | null
        }> | null
      }

    // Create a map of evaluation ID to agents
    const agentMap = new Map<string, { id: string; name: string }[]>()
    agentAssignments?.forEach((assignment) => {
      if (assignment.agents) {
        const evalId = assignment.evaluation_id
        if (!agentMap.has(evalId)) {
          agentMap.set(evalId, [])
        }
        agentMap.get(evalId)!.push({
          id: assignment.agents.id,
          name: assignment.agents.name
        })
      }
    })

    // Add agents to each evaluation
    const evaluationsWithAgents = (evaluations || []).map(ev => ({
      ...ev,
      agents: agentMap.get(ev.id) || []
    }))

    return NextResponse.json({ evaluations: evaluationsWithAgents })
  } catch (error) {
    console.error('Error in GET /api/[slug]/evaluations:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create a new evaluation
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const { user, organizationId } = await getAuthSession(slug)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, prompt, model_provider, model_name, output_schema } = body

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    if (!prompt || prompt.trim().length === 0) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    if (!model_provider) {
      return NextResponse.json({ error: 'Model provider is required' }, { status: 400 })
    }

    if (!model_name) {
      return NextResponse.json({ error: 'Model name is required' }, { status: 400 })
    }

    if (!output_schema) {
      return NextResponse.json({ error: 'Output schema is required' }, { status: 400 })
    }

    // Ensure output_schema is an object
    const parsedSchema = typeof output_schema === 'string' ? JSON.parse(output_schema) : output_schema

    const supabase = await createServiceClient()

    // Verify the organization slug matches the user's organization
    const { data: org } = await supabase
      .from('organisations')
      .select('id')
      .eq('slug', slug)
      .eq('id', organizationId)
      .single()

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Create the evaluation
    const { data: evaluation, error } = await supabase
      .from('evaluations')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        prompt: prompt.trim(),
        model_provider,
        model_name,
        output_schema: parsedSchema,
        organization_id: organizationId,
      })
      .select('id, name, description, prompt, model_provider, model_name, output_schema, created_at, updated_at')
      .single()

    if (error) {
      console.error('Error creating evaluation:', error)
      return NextResponse.json({ error: 'Failed to create evaluation' }, { status: 500 })
    }

    return NextResponse.json({ evaluation }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/[slug]/evaluations:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

