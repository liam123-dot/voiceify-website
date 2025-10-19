import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { UsageMetrics, TranscriptItem } from '@/types/call-events'

type RouteContext = {
  params: Promise<{ slug: string; id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const agentId = id
    const payload = await request.json()

    // Print the complete raw data received
    console.log('\n' + '='.repeat(100))
    console.log('📦 AGENT EVENT RECEIVED')
    console.log('='.repeat(100))
    console.log(JSON.stringify(payload, null, 2))
    console.log('='.repeat(100) + '\n')

    const supabase = await createServiceClient()

    // Extract routing metadata from payload, keep everything else as raw event data
    const { type: eventType, timestamp, twilioCallSid, callerPhoneNumber, ...rawEventData } = payload

    if (!eventType) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing event type',
        },
        { status: 400 }
      )
    }

    // Extract the data field for special event handling (but store full rawEventData in DB)
    const eventData = rawEventData.data || {}

    // Find call record
    let callRecord

    // First try to find by Twilio CallSid (most reliable)
    if (twilioCallSid) {
      console.log(`🔍 Looking up call by Twilio CallSid: ${twilioCallSid}`)
      const { data: callData, error: callError } = await supabase
        .from('calls')
        .select('id, status, created_at')
        .eq('twilio_call_sid', twilioCallSid)
        .single()

      if (!callError && callData) {
        callRecord = callData
        console.log(`✅ Found call by CallSid: ${callRecord.id}`)
      }
    }

    // Fallback: Find by agent_id, caller phone number, and recent timestamp
    if (!callRecord && callerPhoneNumber) {
      console.log(`🔍 Fallback: Looking up call by agent_id + phone number`)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      
      const { data: callData, error: callError } = await supabase
        .from('calls')
        .select('id, status, created_at')
        .eq('agent_id', agentId)
        .eq('caller_phone_number', callerPhoneNumber)
        .gte('created_at', fiveMinutesAgo)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!callError && callData) {
        callRecord = callData
        console.log(`✅ Found call by agent + phone: ${callRecord.id}`)
      }
    }

    if (!callRecord) {
      console.error('❌ Call record not found')
      return NextResponse.json(
        { 
          success: false, 
          error: 'Call record not found',
        },
        { status: 404 }
      )
    }

    // Insert event into agent_events with raw event data
    const { error: eventError } = await supabase
      .from('agent_events')
      .insert({
        call_id: callRecord.id,
        event_type: eventType,
        time: timestamp || new Date().toISOString(),
        data: rawEventData,
      })

    if (eventError) {
      console.error('❌ Failed to insert event:', eventError)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to insert event',
        },
        { status: 500 }
      )
    }

    console.log(`✅ Event '${eventType}' stored successfully`)

    // Handle special event types that update call record
    if (eventType === 'session_complete') {
      const updates: {
        status: string
        ended_at: string
        duration_seconds?: number
        usage_metrics?: UsageMetrics
        config?: Record<string, unknown>
        recording_url?: string
        egress_id?: string
      } = {
        status: 'completed',
        ended_at: new Date().toISOString(),
      }

      // Calculate duration if we have the data
      if (eventData.durationMs) {
        updates.duration_seconds = Math.floor(eventData.durationMs / 1000)
      } else if (callRecord.created_at) {
        const createdAt = new Date(callRecord.created_at).getTime()
        const endedAt = new Date(updates.ended_at).getTime()
        updates.duration_seconds = Math.floor((endedAt - createdAt) / 1000)
      }

      // Store usage metrics if available
      if (eventData.usage) {
        updates.usage_metrics = eventData.usage as UsageMetrics
        console.log(`📊 Storing usage metrics`)
      }

      // Store config if available
      if (eventData.config) {
        updates.config = eventData.config
        console.log(`⚙️ Storing config`)
      }

      // Store recording URL and egress ID if available
      if (eventData.recordingUrl) {
        updates.recording_url = eventData.recordingUrl
        console.log(`🎬 Storing recording URL: ${eventData.recordingUrl}`)
      }

      if (eventData.egressId) {
        updates.egress_id = eventData.egressId
        console.log(`📹 Storing egress ID: ${eventData.egressId}`)
      }

      await supabase
        .from('calls')
        .update(updates)
        .eq('id', callRecord.id)

      console.log(`✅ Call marked as completed (duration: ${updates.duration_seconds}s)`)
    }

    // Handle transcript event - store the full transcript and mark call as completed
    if (eventType === 'transcript') {
      if (eventData.items && Array.isArray(eventData.items)) {
        const updates: {
          transcript: TranscriptItem[]
          status?: string
          ended_at?: string
          duration_seconds?: number
        } = {
          transcript: eventData.items as TranscriptItem[],
        }

        // If call is not already completed, mark it as complete
        if (callRecord.status !== 'completed') {
          updates.status = 'completed'
          updates.ended_at = new Date().toISOString()
          
          // Calculate duration if we have the start time
          if (callRecord.created_at) {
            const createdAt = new Date(callRecord.created_at).getTime()
            const endedAt = new Date(updates.ended_at).getTime()
            updates.duration_seconds = Math.floor((endedAt - createdAt) / 1000)
          }
          
          console.log(`📝 Stored transcript with ${eventData.items.length} items and marked call as completed`)
        } else {
          console.log(`📝 Stored transcript with ${eventData.items.length} items`)
        }

        await supabase
          .from('calls')
          .update(updates)
          .eq('id', callRecord.id)
      }
    }

    return NextResponse.json(
      { 
        success: true, 
        message: 'Event stored successfully',
        callId: callRecord.id,
        eventType,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error processing agent event:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process event',
      },
      { status: 500 }
    )
  }
}

