import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthSession } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params

    const { user, organizationId } = await getAuthSession()

    if (!user || !organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify the call belongs to one of the user's organizations
    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('id, organization_id')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single()

    if (callError || !call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    if (call.organization_id !== organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Fetch agent events for this call
    const { data: events, error: eventsError } = await supabase
      .from('agent_events')
      .select('*')
      .eq('call_id', id)
      .order('time', { ascending: true })

    if (eventsError) {
      console.error('Error fetching events:', eventsError)
      return NextResponse.json(
        { error: 'Failed to fetch events', events: [] },
        { status: 500 }
      )
    }

    return NextResponse.json({ events: events || [] })
  } catch (error) {
    console.error('Error in GET /api/calls/[id]/events:', error)
    return NextResponse.json(
      { error: 'Internal server error', events: [] },
      { status: 500 }
    )
  }
}

