import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import type { AgentRules } from '@/types/agent-rules'
import { createServiceClient } from '@/lib/supabase/server'

type RouteContext = {
  params: Promise<{ slug: string; id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { slug, id } = await context.params
    console.log('slug', slug, id)
    const { user, organizationId } = await getAuthSession(slug)
    console.log('user', user)
    console.log('organizationId', organizationId)
    if (!user || !organizationId) {
      return NextResponse.json(
        { error: 'Not authenticated or no organization found' },
        { status: 401 }
      )
    }

    const supabase = await createServiceClient()

    // Get the agent's rules
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('rules')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single()

    if (agentError || !agent) {
      console.error('Agent not found:', agentError)
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Parse rules safely
    const rules = agent.rules 
      ? (typeof agent.rules === 'string' 
          ? JSON.parse(agent.rules) 
          : agent.rules) as AgentRules
      : undefined

    return NextResponse.json({ rules })
  } catch (error) {
    console.error('Error in /api/[organizationId]/agents/[id]/rules GET:', error)
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
        { error: 'Not authenticated or no organization found' },
        { status: 401 }
      )
    }
    const supabase = await createServiceClient()

    // Parse request body
    const body = await request.json()
    const { rules } = body as { rules: AgentRules }

    // Validate rules
    if (!rules) {
      return NextResponse.json(
        { error: 'Rules are required' },
        { status: 400 }
      )
    }

    // Validate time-based routing schedules
    if (rules.timeBasedRouting?.enabled && rules.timeBasedRouting.schedules) {
      for (const schedule of rules.timeBasedRouting.schedules) {
        if (!schedule.days || schedule.days.length === 0) {
          return NextResponse.json(
            { error: 'Each schedule must have at least one day selected' },
            { status: 400 }
          )
        }
        if (!schedule.startTime || !schedule.endTime) {
          return NextResponse.json(
            { error: 'Each schedule must have start and end times' },
            { status: 400 }
          )
        }
        if (!schedule.transferTo || schedule.transferTo.trim() === '') {
          return NextResponse.json(
            { error: 'Each schedule must have a transfer number' },
            { status: 400 }
          )
        }
      }
    }

    // Validate agent fallback
    if (rules.agentFallback?.enabled) {
      if (!rules.agentFallback.timeoutSeconds || 
          rules.agentFallback.timeoutSeconds < 5 || 
          rules.agentFallback.timeoutSeconds > 300) {
        return NextResponse.json(
          { error: 'Timeout must be between 5 and 300 seconds' },
          { status: 400 }
        )
      }
    }

    // Update the agent's rules
    const { data: agent, error: updateError } = await supabase
      .from('agents')
      .update({ 
        rules,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select()
      .single()

    if (updateError || !agent) {
      console.error('Error updating agent rules:', updateError)
      return NextResponse.json(
        { error: 'Failed to update agent rules' },
        { status: 500 }
      )
    }

    return NextResponse.json({ rules: agent.rules })
  } catch (error) {
    console.error('Error in /api/[organizationId]/agents/[id]/rules PATCH:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

