import { createServiceClient } from '@/lib/supabase/server'
import type { UsageMetrics, TranscriptItem } from '@/types/call-events'
import { findCallRecord, saveAgentEvent } from '@/lib/calls'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const agentId = id;
    const payload = await request.json();

    // Print the complete raw data received
    console.log('\n' + '='.repeat(100));
    console.log('📦 AGENT EVENT RECEIVED');
    console.log('='.repeat(100));
    console.log(JSON.stringify(payload, null, 2));
    console.log('='.repeat(100) + '\n');

    const supabase = await createServiceClient();

    // Extract routing metadata from payload, keep everything else as raw event data
    const { type: eventType, timestamp, twilioCallSid, callerPhoneNumber, roomName, ...rawEventData } = payload;

    if (!eventType) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing event type',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Extract the data field for special event handling (but store full rawEventData in DB)
    const eventData = rawEventData.data || {};

    // Find call record - prioritize roomName for matching
    const callRecord = await findCallRecord({
      roomName,
      twilioCallSid,
      agentId,
      callerPhoneNumber,
    });

    if (!callRecord) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Call record not found',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Insert event into agent_events with raw event data
    const eventResult = await saveAgentEvent({
      callId: callRecord.id,
      eventType,
      eventData: rawEventData,
      timestamp: timestamp || new Date().toISOString(),
    });

    if (!eventResult.success) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: eventResult.error || 'Failed to insert event',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (eventType === 'room_connected') {
      const updates: {
        livekit_room_name?: string;
        twilio_call_sid?: string;
      } = {};
      
      // Set the LiveKit room name - this becomes the primary identifier going forward
      if (eventData.roomName) {
        updates.livekit_room_name = eventData.roomName;
      }
      
      // Update the twilio_call_sid if provided in the event and it's different from what we have
      // This handles the case where the SIP connection creates a new CallSid
      if (twilioCallSid && (!callRecord.twilio_call_sid || callRecord.twilio_call_sid !== twilioCallSid)) {
        updates.twilio_call_sid = twilioCallSid;
        console.log(`📝 Updating CallSid from ${callRecord.twilio_call_sid} to ${twilioCallSid}`);
      }
      
      if (Object.keys(updates).length > 0) {
        await supabase
          .from('calls')
          .update(updates)
          .eq('id', callRecord.id);
        console.log(`✅ Room connected - updated call record with room name: ${updates.livekit_room_name}${updates.twilio_call_sid ? ` and CallSid: ${updates.twilio_call_sid}` : ''}`);
      }
    }

    // Handle special event types that update call record
    if (eventType === 'session_complete') {
      const updates: {
        status: string;
        ended_at: string;
        duration_seconds?: number;
        usage_metrics?: UsageMetrics;
        config?: Record<string, unknown>;
        recording_url?: string;
        egress_id?: string;
      } = {
        status: 'completed',
        ended_at: new Date().toISOString(),
      };

      // Calculate duration if we have the data
      if (eventData.durationMs) {
        updates.duration_seconds = Math.floor(eventData.durationMs / 1000);
      } else if (callRecord.created_at) {
        const createdAt = new Date(callRecord.created_at).getTime();
        const endedAt = new Date(updates.ended_at).getTime();
        updates.duration_seconds = Math.floor((endedAt - createdAt) / 1000);
      }

      // Store usage metrics if available
      if (eventData.usage) {
        updates.usage_metrics = eventData.usage as UsageMetrics;
        console.log(`📊 Storing usage metrics`);
      }

      // Store config if available
      if (eventData.config) {
        updates.config = eventData.config;
        console.log(`⚙️ Storing config`);
      }

      // Store recording URL and egress ID if available
      if (eventData.recordingUrl) {
        updates.recording_url = eventData.recordingUrl;
        console.log(`🎬 Storing recording URL: ${eventData.recordingUrl}`);
      }

      if (eventData.egressId) {
        updates.egress_id = eventData.egressId;
        console.log(`📹 Storing egress ID: ${eventData.egressId}`);
      }

      await supabase
        .from('calls')
        .update(updates)
        .eq('id', callRecord.id);

      console.log(`✅ Call marked as completed (duration: ${updates.duration_seconds}s)`);

      // Calculate and store latency statistics
      try {
        console.log('📊 Calculating and saving latency statistics...');
        
        // Import and use the shared calculation function
        const { calculateLatencyStats } = await import('@/app/api/[slug]/calls/[callId]/latency-stats/route');
        await calculateLatencyStats(callRecord.id, supabase, { saveToDatabase: true });
      } catch (error) {
        console.error('Error calculating latency statistics:', error);
      }
    }

    // Handle transcript event - store the full transcript and mark call as completed
    if (eventType === 'transcript') {
      if (eventData.items && Array.isArray(eventData.items)) {
        const updates: {
          transcript: TranscriptItem[];
          status?: string;
          ended_at?: string;
          duration_seconds?: number;
        } = {
          transcript: eventData.items as TranscriptItem[],
        };

        // If call is not already completed, mark it as complete
        if (callRecord.status !== 'completed') {
          updates.status = 'completed';
          updates.ended_at = new Date().toISOString();
          
          // Calculate duration if we have the start time
          if (callRecord.created_at) {
            const createdAt = new Date(callRecord.created_at).getTime();
            const endedAt = new Date(updates.ended_at).getTime();
            updates.duration_seconds = Math.floor((endedAt - createdAt) / 1000);
          }
          
          console.log(`📝 Stored transcript with ${eventData.items.length} items and marked call as completed`);
        } else {
          console.log(`📝 Stored transcript with ${eventData.items.length} items`);
        }

        await supabase
          .from('calls')
          .update(updates)
          .eq('id', callRecord.id);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Event stored successfully',
        callId: callRecord.id,
        eventType,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error processing agent event:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to process event',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}