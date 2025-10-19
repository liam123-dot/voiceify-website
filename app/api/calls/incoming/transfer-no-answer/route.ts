// /api/calls/incoming/callback/route.ts
import { NextResponse } from 'next/server'
import { findCallRecord, saveAgentEvent } from '@/lib/calls'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    
    // Log all parameters for debugging
    console.log('\n📞 DIAL CALLBACK RECEIVED:')
    const allParams: Record<string, string> = {}
    formData.forEach((value, key) => {
      allParams[key] = value.toString()
      console.log(`  ${key}: ${value}`)
    })
    
    const dialCallStatus = formData.get('DialCallStatus') as string
    const callSid = formData.get('CallSid') as string
    const to = formData.get('To') as string
    
    // Find the call record
    const callRecord = await findCallRecord({
      twilioCallSid: callSid,
    })
    
    if (callRecord) {
      console.log(`✅ Found call record: ${callRecord.id}`)
    } else {
      console.warn('⚠️ Could not find call record, but proceeding with callback handling')
    }
    
    console.log('\n🔍 Key Parameters:')
    console.log(`  DialCallStatus: ${dialCallStatus}`)
    console.log(`  CallSid: ${callSid}`)
    
    const livekitSipEndpoint = process.env.LIVEKIT_SIP_ENDPOINT
    
    if (!livekitSipEndpoint) {
      throw new Error('LiveKit SIP endpoint not configured')
    }
    
    // Check if transfer failed
    if (dialCallStatus === 'no-answer' || dialCallStatus === 'failed' || dialCallStatus === 'busy') {
      console.log('❌ Transfer failed, reconnecting to AI agent')
      
      // Save appropriate event based on failure reason
      if (callRecord) {
        if (dialCallStatus === 'no-answer') {
          await saveAgentEvent({
            callId: callRecord.id,
            eventType: 'transfer_no_answer',
            eventData: {
              dialCallStatus,
              transferTarget: to,
            },
          })
        } else {
          await saveAgentEvent({
            callId: callRecord.id,
            eventType: 'transfer_failed',
            eventData: {
              dialCallStatus,
              reason: dialCallStatus,
            },
          })
        }

        // Save reconnection event
        await saveAgentEvent({
          callId: callRecord.id,
          eventType: 'transfer_reconnected',
          eventData: {
            reason: dialCallStatus,
            livekitRoomName: callRecord.livekit_room_name,
          },
        })
      }
      
      // Reconnect to AI agent
      const sipUri = `sip:${callRecord?.livekit_room_name}@${livekitSipEndpoint}`

      console.log(`  SIP URI: ${sipUri}`)
      
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>The transfer could not be completed. Reconnecting you to the agent.</Say>
  <Dial>
    <Sip>${sipUri}</Sip>
  </Dial>
</Response>`,
        { headers: { 'Content-Type': 'text/xml' } }
      )
    }
    
    // Transfer succeeded or call completed normally
    console.log('✅ Transfer completed or call ended normally')
    
    // Save transfer success event
    if (callRecord) {
      await saveAgentEvent({
        callId: callRecord.id,
        eventType: 'transfer_success',
        eventData: {
          dialCallStatus,
          transferTarget: to,
        },
      })
    }
    
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Hangup/>
</Response>`,
      { headers: { 'Content-Type': 'text/xml' } }
    )
    
  } catch (error) {
    console.error('❌ Error in callback handler:', error)
    
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>An error occurred.</Say>
  <Hangup/>
</Response>`,
      { headers: { 'Content-Type': 'text/xml' } }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Dial callback endpoint',
    note: 'This endpoint accepts POST requests from Twilio dial callbacks'
  })
}