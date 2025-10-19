import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { findCallRecord, saveAgentEvent } from '@/lib/calls'

export async function POST(request: Request) {
  try {
    const supabase = await createServiceClient()
    
    console.log('='.repeat(80))
    console.log('INCOMING CALL CALLBACK (Forwarding to Agent)')
    console.log('='.repeat(80))
    
    const formData = await request.formData()
    
    console.log('\n📦 CALLBACK PARAMETERS:')
    const allParams: Record<string, string> = {}
    formData.forEach((value, key) => {
      allParams[key] = value.toString()
      console.log(`  ${key}: ${value}`)
    })
    
    const to = formData.get('To') as string
    const from = formData.get('From') as string
    const callSid = formData.get('CallSid') as string
    const dialCallStatus = formData.get('DialCallStatus') as string
    
    console.log('\n🔑 KEY PARAMETERS:')
    console.log(`  To: ${to}`)
    console.log(`  From: ${from}`)
    console.log(`  CallSid: ${callSid}`)
    console.log(`  DialCallStatus: ${dialCallStatus}`)

    if (!to) {
      console.error('❌ Missing To parameter!')
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say>An error occurred.</Say>
          <Hangup/>
        </Response>`,
        { headers: { 'Content-Type': 'text/xml' } }
      )
    }

    // Look up the phone number and agent
    console.log('\n🔍 DATABASE LOOKUP:')
    console.log(`  Looking up phone number: ${to}`)
    
    const { data: phoneNumber, error: phoneError } = await supabase
      .from('phone_numbers')
      .select('*, agents(*)')
      .eq('phone_number', to)
      .single()

    if (phoneError || !phoneNumber?.agents) {
      console.error('❌ Database error or no agent found:', phoneError)
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say>Unable to connect to an agent.</Say>
          <Hangup/>
        </Response>`,
        { headers: { 'Content-Type': 'text/xml' } }
      )
    }

    const agent = phoneNumber.agents
    console.log('✅ Agent found:', {
      id: agent.id,
      name: agent.name,
    })

    // Find the existing call record using improved lookup strategy
    console.log('\n🔍 FINDING CALL RECORD:')
    const callRecord = await findCallRecord({
      twilioCallSid: callSid,
      agentId: agent.id,
      callerPhoneNumber: from,
    })

    if (!callRecord) {
      console.error('❌ Call record not found')
      // Continue anyway, but log the error
    } else {
      console.log(`  ✅ Call record found: ${callRecord.id}`)

      // Update call status to connected_to_agent
      await supabase
        .from('calls')
        .update({ status: 'connected_to_agent' })
        .eq('id', callRecord.id)

      // Track the team no answer fallback event
      await saveAgentEvent({
        callId: callRecord.id,
        eventType: 'team_no_answer_fallback',
        eventData: {
          dialCallStatus: dialCallStatus,
          fallbackReason: 'Team did not answer, routing to agent',
        },
      })

      console.log('  ✅ Fallback event tracked')
    }

    // LiveKit Configuration
    const livekitSipEndpoint = process.env.LIVEKIT_SIP_ENDPOINT
    const livekitUsername = process.env.LIVEKIT_SIP_USERNAME
    
    console.log('\n🎯 LIVEKIT CONFIGURATION:')
    console.log(`  LIVEKIT_SIP_ENDPOINT: ${livekitSipEndpoint || 'NOT SET'}`)
    console.log(`  LIVEKIT_SIP_USERNAME: ${livekitUsername || 'NOT SET'}`)

    if (!livekitSipEndpoint) {
      console.error('❌ LiveKit SIP endpoint not configured!')
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say>Service not configured.</Say>
          <Hangup/>
        </Response>`,
        { headers: { 'Content-Type': 'text/xml' } }
      )
    }

    // Generate TwiML to connect to agent
    const sipUri = `sip:${to}@${livekitSipEndpoint}`
    console.log(`  SIP URI: ${sipUri}`)
    
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Connecting you to an agent.</Say>
  <Dial>
    <Sip${livekitUsername ? ` username="${livekitUsername}"` : ''}${process.env.LIVEKIT_SIP_PASSWORD ? ` password="${process.env.LIVEKIT_SIP_PASSWORD}"` : ''}>
      <Header name="X-Agent-ID" value="${agent.id}"/>
      <Header name="X-Agent-Name" value="${agent.name}"/>
      <Header name="X-Phone-Number" value="${to}"/>
      <Header name="X-Caller-ID" value="${from}"/>
      <Header name="X-Call-SID" value="${callSid}"/>
      ${sipUri}
    </Sip>
  </Dial>
</Response>`

    console.log('\n📤 TWIML RESPONSE:')
    console.log(twimlResponse)
    console.log('='.repeat(80))
    console.log('\n')

    return new Response(twimlResponse, {
      headers: { 'Content-Type': 'text/xml' }
    })

  } catch (error) {
    console.error('\n❌ ERROR IN CALLBACK:')
    console.error(error)
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace')
    console.log('='.repeat(80))
    
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say>An error occurred. Please try again later.</Say>
        <Hangup/>
      </Response>`,
      { headers: { 'Content-Type': 'text/xml' } }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Incoming calls callback endpoint',
    note: 'This endpoint handles fallback to agent when forwarding fails'
  })
}

