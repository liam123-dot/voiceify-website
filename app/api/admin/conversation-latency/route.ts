import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkAdminAuth } from '@/app/(admin)/lib/admin-auth'

export const dynamic = 'force-dynamic'

interface CallConfig {
  pipeline?: {
    llm?: {
      model?: string
      inferenceType?: string
    }
    tts?: {
      inferenceType?: string
    }
    stt?: {
      inferenceType?: string
    }
  }
}

interface EventFromDB {
  id: string
  time: string
  call_id: string
  event_type: string
  data: Record<string, unknown>
  calls: {
    config: CallConfig
    organisations: {
      id: string
      slug: string
      external_id: string
    }
  }
}

export async function GET(request: Request) {
  try {
    // Verify admin access
    const { isAdmin, user } = await checkAdminAuth()
    
    if (!isAdmin || !user) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 })
    }

    // Get optional slug parameter for filtering
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')

    const supabase = await createServiceClient()

    // Build query to fetch total_latency events with organization info and call config
    let query = supabase
      .from('agent_events')
      .select(`
        id,
        time,
        call_id,
        event_type,
        data,
        calls!inner (
          organization_id,
          config,
          organisations!inner (
            id,
            slug,
            external_id
          )
        )
      `)
      .eq('event_type', 'total_latency')
      .order('time', { ascending: false })

    // If slug is provided, filter by that organization
    if (slug) {
      // First, get the organization ID from the slug
      const { data: org, error: orgError } = await supabase
        .from('organisations')
        .select('id')
        .eq('slug', slug)
        .single()

      if (orgError || !org) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
      }

      // Filter events by organization through calls join
      query = query.eq('calls.organization_id', org.id)
    }

    const { data: events, error } = await query

    if (error) {
      console.error('Error fetching conversation latency events:', error)
      return NextResponse.json({ error: 'Failed to fetch conversation latency data' }, { status: 500 })
    }

    // Transform the data to include organization slug and config info at the top level
    const transformedEvents = events?.map((event) => {
      // Type assertion for the nested structure since Supabase types can be complex
      const eventWithOrg = event as unknown as EventFromDB
      const config = eventWithOrg.calls.config
      const pipeline = config?.pipeline || {}
      
      return {
        id: eventWithOrg.id,
        time: eventWithOrg.time,
        call_id: eventWithOrg.call_id,
        event_type: eventWithOrg.event_type,
        data: eventWithOrg.data,
        organization_id: eventWithOrg.calls.organisations.id,
        organization_slug: eventWithOrg.calls.organisations.slug,
        llm_model: pipeline.llm?.model || null,
        llm_inference_type: pipeline.llm?.inferenceType || null,
        tts_inference_type: pipeline.tts?.inferenceType || null,
        stt_inference_type: pipeline.stt?.inferenceType || null,
      }
    }) || []

    return NextResponse.json({ events: transformedEvents })

  } catch (error) {
    console.error('Error in conversation latency API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

