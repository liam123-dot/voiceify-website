import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import type { AgentConfiguration } from '@/types/agent-config'

type RouteContext = {
  params: Promise<{ slug: string; id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { slug, id } = await context.params
    const { user, organizationId } = await getAuthSession(slug)

    if (!user || !organizationId) {
      return NextResponse.json(
        { error: 'Not authenticated or unauthorized' },
        { status: 401 }
      )
    }

    const supabase = await createServiceClient()

    // Get the agent (RLS will ensure user can only see agents from their org)
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single()

    if (agentError || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ agent })
  } catch (error) {
    console.error('Error in /api/[organizationId]/agents/[id] GET:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { slug, id } = await context.params
    const { user, organizationId } = await getAuthSession(slug)

    if (!user || !organizationId) {
      return NextResponse.json(
        { error: 'Not authenticated or unauthorized' },
        { status: 401 }
      )
    }

    const supabase = await createServiceClient()

    // Parse request body
    const body = await request.json()
    const { configuration } = body as { configuration: AgentConfiguration }

    // Validate configuration
    if (!configuration) {
      return NextResponse.json(
        { error: 'Configuration is required' },
        { status: 400 }
      )
    }

    // Validate pipelineType
    if (!['realtime', 'pipeline'].includes(configuration.pipelineType)) {
      return NextResponse.json(
        { error: 'Invalid pipelineType. Must be "realtime" or "pipeline"' },
        { status: 400 }
      )
    }

    // Validate instructions
    if (!configuration.instructions || configuration.instructions.length < 10) {
      return NextResponse.json(
        { error: 'Instructions must be at least 10 characters long' },
        { status: 400 }
      )
    }

    // Validate realtime model if pipeline type is realtime
    if (configuration.pipelineType === 'realtime' && !configuration.realtimeModel) {
      return NextResponse.json(
        { error: 'realtimeModel is required when pipelineType is "realtime"' },
        { status: 400 }
      )
    }

    // Validate pipeline if pipeline type is pipeline
    if (configuration.pipelineType === 'pipeline' && !configuration.pipeline) {
      return NextResponse.json(
        { error: 'pipeline configuration is required when pipelineType is "pipeline"' },
        { status: 400 }
      )
    }

    // Update the agent
    const { data: agent, error: updateError } = await supabase
      .from('agents')
      .update({ 
        configuration,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select()
      .single()

    if (updateError || !agent) {
      console.error('Error updating agent:', updateError)
      return NextResponse.json(
        { error: 'Failed to update agent' },
        { status: 500 }
      )
    }

    return NextResponse.json({ agent })
  } catch (error) {
    console.error('Error in /api/[organizationId]/agents/[id] PATCH:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

