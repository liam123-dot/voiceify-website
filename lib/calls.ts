import { createServiceClient } from '@/lib/supabase/server'
import { Call, CallEventType, CallEventData } from '@/types/call-events'

export interface FindCallParams {
  twilioCallSid?: string | null
  agentId?: string | null
  callerPhoneNumber?: string | null
  roomName?: string | null
}

export interface SaveAgentEventParams {
  callId: string
  eventType: CallEventType
  eventData: CallEventData | Record<string, unknown>
  timestamp?: string
}

/**
 * Find a call record in the database
 * 
 * Priority order for finding calls:
 * 1. LiveKit room name (most reliable after room_connected event)
 * 2. Twilio CallSid (reliable for initial routing)
 * 3. agent_id + caller phone number + recent timestamp (fallback)
 * 
 * @param params - Parameters to search for the call
 * @returns Call record or null if not found
 */
export async function findCallRecord(params: FindCallParams): Promise<Call | null> {
  const { twilioCallSid, agentId, callerPhoneNumber, roomName } = params
  const supabase = await createServiceClient()
  
  let callRecord: Call | null = null
  
  // Priority 1: Try to find by LiveKit room name (most reliable once set)
  if (roomName) {
    console.log(`🔍 Looking up call by LiveKit room name: ${roomName}`)
    const { data: callData, error: callError } = await supabase
      .from('calls')
      .select('*')
      .eq('livekit_room_name', roomName)
      .single()

    if (!callError && callData) {
      callRecord = callData as Call
      console.log(`✅ Found call by room name: ${callRecord.id}`)
      return callRecord
    } else if (callError && callError.code !== 'PGRST116') {
      // PGRST116 is "not found" - other errors should be logged
      console.warn(`⚠️ Error looking up by room name: ${callError.message}`)
    }
  }
  
  // Priority 2: Try to find by Twilio CallSid
  if (twilioCallSid) {
    console.log(`🔍 Looking up call by Twilio CallSid: ${twilioCallSid}`)
    const { data: callData, error: callError } = await supabase
      .from('calls')
      .select('*')
      .eq('twilio_call_sid', twilioCallSid)
      .single()

    if (!callError && callData) {
      callRecord = callData as Call
      console.log(`✅ Found call by CallSid: ${callRecord.id}`)
      return callRecord
    } else if (callError && callError.code !== 'PGRST116') {
      console.warn(`⚠️ Error looking up by CallSid: ${callError.message}`)
    }
  }

  // Priority 3: Fallback - Find by agent_id, caller phone number, and recent timestamp
  if (!callRecord && callerPhoneNumber && agentId) {
    console.log(`🔍 Fallback: Looking up call by agent_id + caller phone number`)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    
    const { data: callData, error: callError } = await supabase
      .from('calls')
      .select('*')
      .eq('agent_id', agentId)
      .eq('caller_phone_number', callerPhoneNumber)
      .gte('created_at', fiveMinutesAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!callError && callData) {
      callRecord = callData as Call
      console.log(`✅ Found call by agent + caller phone: ${callRecord.id}`)
      return callRecord
    } else if (callError && callError.code !== 'PGRST116') {
      console.warn(`⚠️ Error in fallback lookup: ${callError.message}`)
    }
  }

  if (!callRecord) {
    console.error('❌ Call record not found', { roomName, twilioCallSid, agentId, callerPhoneNumber })
  }

  return callRecord
}

/**
 * Save an agent event to the database
 * 
 * @param params - Event parameters including call ID, event type, and data
 * @returns Success status and error if any
 */
export async function saveAgentEvent(params: SaveAgentEventParams): Promise<{
  success: boolean
  error?: string
}> {
  const { callId, eventType, eventData, timestamp } = params
  const supabase = await createServiceClient()

  try {
    const { error: eventError } = await supabase
      .from('agent_events')
      .insert({
        call_id: callId,
        event_type: eventType,
        time: timestamp || new Date().toISOString(),
        data: eventData,
      })

    if (eventError) {
      console.error(`❌ Failed to insert event '${eventType}':`, eventError)
      return {
        success: false,
        error: 'Failed to insert event',
      }
    }

    console.log(`✅ Event '${eventType}' stored successfully`)
    return { success: true }
  } catch (error) {
    console.error(`❌ Error saving event '${eventType}':`, error)
    return {
      success: false,
      error: 'Failed to save event',
    }
  }
}

