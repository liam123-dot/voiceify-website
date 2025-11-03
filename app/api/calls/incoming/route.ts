import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { AgentRules, DayOfWeek } from '@/types/agent-rules'
import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================
// Types
// ============================================

interface TwilioCallParams {
  to: string
  from: string
  callSid: string
}

interface AgentData {
  id: string
  name: string
  rules: AgentRules | null
}

interface RoutingDecision {
  shouldTransfer: boolean
  transferNumber: string | null
  timeout: number
  enableFallback: boolean
}

// ============================================
// Helper Functions
// ============================================

/**
 * Check if current time is within a schedule
 */
function isWithinSchedule(schedule: AgentRules['timeBasedRouting']['schedules'][0]): boolean {
  const now = new Date()
  const dayNames: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const currentDay = dayNames[now.getDay()]
  
  // Check if current day is in schedule
  if (!schedule.days.includes(currentDay)) {
    return false
  }
  
  // Parse schedule times
  const [startHour, startMin] = schedule.startTime.split(':').map(Number)
  const [endHour, endMin] = schedule.endTime.split(':').map(Number)
  
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const startMinutes = startHour * 60 + startMin
  const endMinutes = endHour * 60 + endMin
  
  return currentMinutes >= startMinutes && currentMinutes < endMinutes
}

/**
 * Extract call parameters from Twilio webhook
 */
async function extractCallParams(request: Request): Promise<TwilioCallParams> {
  const formData = await request.formData()
  
  console.log('\n📦 FORM DATA (All Parameters):')
  const allParams: Record<string, string> = {}
  formData.forEach((value, key) => {
    allParams[key] = value.toString()
    console.log(`  ${key}: ${value}`)
  })
  
  console.log('\n📄 RAW JSON:')
  console.log(JSON.stringify(allParams, null, 2))
  
  const to = formData.get('To') as string
  const from = formData.get('From') as string
  const callSid = formData.get('CallSid') as string
  
  console.log('\n🔑 KEY PARAMETERS:')
  console.log(`  To: ${to}`)
  console.log(`  From: ${from}`)
  console.log(`  CallSid: ${callSid}`)
  
  return { to, from, callSid }
}

/**
 * Look up phone number and agent from database
 */
async function lookupAgent(
  supabase: SupabaseClient,
  phoneNumber: string
): Promise<AgentData | null> {
  console.log('\n🔍 DATABASE LOOKUP:')
  console.log(`  Looking up phone number: ${phoneNumber}`)
  
  const { data, error } = await supabase
    .from('phone_numbers')
    .select('*, agents(id, name, rules)')
    .eq('phone_number', phoneNumber)
    .single()

  if (error) {
    console.error('❌ Database error:', error)
    return null
  }
  
  if (!data) {
    console.error('❌ Phone number not found in database')
    return null
  }
  
  console.log('✅ Phone number found:', data)
  
  if (!data.agents) {
    console.error('❌ No agent assigned to this phone number')
    return null
  }
  
  const agent = data.agents
  console.log('✅ Agent found:', {
    id: agent.id,
    name: agent.name,
    rules: agent.rules
  })
  
  // Parse agent rules
  const rules = agent.rules 
    ? (typeof agent.rules === 'string' ? JSON.parse(agent.rules) : agent.rules) as AgentRules
    : null
  
  return {
    id: agent.id,
    name: agent.name,
    rules
  }
}

/**
 * Determine routing decision based on agent rules
 */
function determineRouting(rules: AgentRules | null): RoutingDecision {
  console.log('\n📞 APPLYING ROUTING RULES:')
  
  const decision: RoutingDecision = {
    shouldTransfer: false,
    transferNumber: null,
    timeout: 30,
    enableFallback: false
  }
  
  // Check if time-based routing is enabled
  if (!rules?.timeBasedRouting?.enabled || rules.timeBasedRouting.schedules.length === 0) {
    console.log('  ℹ️  Time-based routing is DISABLED - routing directly to agent')
    return decision
  }
  
  console.log('  ✅ Time-based routing is ENABLED')
  
  // Check each schedule to see if we're within business hours
  for (const schedule of rules.timeBasedRouting.schedules) {
    if (isWithinSchedule(schedule)) {
      decision.shouldTransfer = true
      decision.transferNumber = schedule.transferTo
      console.log(`  ✅ Within schedule: ${schedule.days.join(', ')} ${schedule.startTime}-${schedule.endTime}`)
      console.log(`  📞 Will transfer to: ${decision.transferNumber}`)
      break
    }
  }
  
  if (!decision.shouldTransfer) {
    console.log('  ⏰ Outside business hours - routing to agent')
    return decision
  }
  
  // Check if agent fallback is enabled
  if (rules.agentFallback?.enabled) {
    decision.enableFallback = true
    decision.timeout = rules.agentFallback.timeoutSeconds
    console.log(`  ⏱️  Agent fallback ENABLED - will route to agent if no answer after ${decision.timeout}s`)
  } else {
    console.log('  ℹ️  Agent fallback DISABLED - call will ring until answered or caller hangs up')
  }
  
  return decision
}

/**
 * Generate TwiML for transferring to a phone number
 */
function generateTransferTwiML(transferNumber: string, timeout: number, enableFallback: boolean): string {
  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/calls/incoming/callback`
  
  console.log('\n📞 GENERATING TWIML:')
  console.log(`  Action: TRANSFER`)
  console.log(`  Transfer to: ${transferNumber}`)
  console.log(`  Timeout: ${timeout}s`)
  
  if (enableFallback) {
    console.log(`  Callback URL: ${callbackUrl}`)
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial action="${callbackUrl}" timeout="${timeout}">
    <Number>${transferNumber}</Number>
  </Dial>
</Response>`
  } else {
    console.log(`  No callback - will ring until answered or caller hangs up`)
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="${timeout}">
    <Number>${transferNumber}</Number>
  </Dial>
</Response>`
  }
}

/**
 * Generate TwiML for connecting directly to agent
 */
function generateAgentTwiML(agent: AgentData, params: TwilioCallParams, callId: string): string {
  const livekitSipEndpoint = process.env.LIVEKIT_SIP_ENDPOINT
  const livekitUsername = process.env.LIVEKIT_SIP_USERNAME

  console.log('\n📞 GENERATING TWIML:')
  console.log(`  Action: ROUTE TO AGENT`)
  console.log(`  LIVEKIT_SIP_ENDPOINT: ${livekitSipEndpoint || 'NOT SET'}`)
  console.log(`  LIVEKIT_SIP_USERNAME: ${livekitUsername || 'NOT SET'}`)
  console.log(`  Call ID: ${callId}`)
  
  if (!livekitSipEndpoint) {
    throw new Error('LiveKit SIP endpoint not configured')
  }
  
  const sipUri = `sip:${params.to}@${livekitSipEndpoint}`
  console.log(`  SIP URI: ${sipUri}`)
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial referUrl="${process.env.NEXT_PUBLIC_APP_URL}/api/calls/incoming/refer" ringTone="uk">
    <Sip>
      ${sipUri}
    </Sip>
  </Dial>
</Response>`
}

/**
 * Generate error TwiML response
 */
function generateErrorTwiML(message: string): Response {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Say>${message}</Say>
      <Hangup/>
    </Response>`,
    { headers: { 'Content-Type': 'text/xml' } }
  )
}

// ============================================
// Main Handler
// ============================================

export async function POST(request: Request) {
  try {
    const supabase = await createServiceClient()
    
    console.log('='.repeat(80))
    console.log('INCOMING TWILIO WEBHOOK')
    console.log('='.repeat(80))
    
    // Log all headers
    console.log('\n📋 HEADERS:')
    request.headers.forEach((value, key) => {
      console.log(`  ${key}: ${value}`)
    })
    
    // Extract call parameters from Twilio webhook
    const params = await extractCallParams(request)
    
    if (!params.to) {
      console.error('❌ Missing To parameter!')
      return generateErrorTwiML('Missing required parameters.')
    }
    
    // Look up agent from database
    const agent = await lookupAgent(supabase, params.to)
    
    if (!agent) {
      return generateErrorTwiML('This phone number is not configured.')
    }
    
    // Get agent's organization_id
    const { data: agentData, error: agentError } = await supabase
      .from('agents')
      .select('organization_id')
      .eq('id', agent.id)
      .single()

    if (agentError || !agentData) {
      console.error('❌ Failed to fetch agent organization:', agentError)
      return generateErrorTwiML('Service configuration error.')
    }

    // Create call record in database (ALWAYS, regardless of routing)
    console.log('\n📝 CREATING CALL RECORD:')
    console.log(`  Agent ID: ${agent.id}`)
    console.log(`  Organization ID: ${agentData.organization_id}`)
    console.log(`  Caller Phone Number: ${params.from}`)
    console.log(`  Trunk Phone Number: ${params.to}`)
    console.log(`  Twilio Call SID: ${params.callSid}`)
    
    const { data: callData, error: callError } = await supabase
      .from('calls')
      .insert({
        agent_id: agent.id,
        organization_id: agentData.organization_id,
        caller_phone_number: params.from,
        trunk_phone_number: params.to,
        twilio_call_sid: params.callSid,
        status: 'incoming',
      })
      .select('id')
      .single()

    if (callError || !callData) {
      console.error('❌ Failed to create call record:', callError)
      return generateErrorTwiML('Service error.')
    }

    console.log(`  ✅ Call record created: ${callData.id}`)

    // Insert initial call_incoming event
    await supabase
      .from('agent_events')
      .insert({
        call_id: callData.id,
        event_type: 'call_incoming',
        time: new Date().toISOString(),
        data: {
          caller: params.from,
          trunk: params.to,
          callSid: params.callSid,
        },
      })

    // Determine routing based on rules
    const routing = determineRouting(agent.rules)
    
    // Generate appropriate TwiML response
    let twimlResponse: string
    
    if (routing.shouldTransfer && routing.transferNumber) {
      // Update call status to transferred_to_team
      await supabase
        .from('calls')
        .update({ status: 'transferred_to_team' })
        .eq('id', callData.id)

      // Track the transfer event
      await supabase
        .from('agent_events')
        .insert({
          call_id: callData.id,
          event_type: 'transferred_to_team',
          time: new Date().toISOString(),
          data: {
            transferNumber: routing.transferNumber,
            timeout: routing.timeout,
            fallbackEnabled: routing.enableFallback,
          },
        })

      twimlResponse = generateTransferTwiML(routing.transferNumber, routing.timeout, routing.enableFallback)
    } else {
      // Update call status to connected_to_agent
      await supabase
        .from('calls')
        .update({ status: 'connected_to_agent' })
        .eq('id', callData.id)

      // Track the routing event
      await supabase
        .from('agent_events')
        .insert({
          call_id: callData.id,
          event_type: 'routed_to_agent',
          time: new Date().toISOString(),
          data: {
            direct: true,
          },
        })

      twimlResponse = generateAgentTwiML(agent, params, callData.id)
    }
    
    console.log('\n📤 TWIML RESPONSE:')
    console.log(twimlResponse)
    console.log('='.repeat(80))
    console.log('\n')

    return new Response(twimlResponse, {
      headers: { 'Content-Type': 'text/xml' }
    })

  } catch (error) {
    console.error('\n❌ ERROR IN WEBHOOK:')
    console.error(error)
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace')
    console.log('='.repeat(80))
    
    return generateErrorTwiML('An error occurred. Please try again later.')
  }
}

export async function GET() {
  console.log('GET request received on /api/calls/incoming')
  return NextResponse.json({
    message: 'Incoming calls webhook endpoint',
    note: 'This endpoint accepts POST requests with Twilio webhook data',
    env_check: {
      LIVEKIT_SIP_ENDPOINT: process.env.LIVEKIT_SIP_ENDPOINT ? 'SET' : 'NOT SET',
      LIVEKIT_SIP_USERNAME: process.env.LIVEKIT_SIP_USERNAME ? 'SET' : 'NOT SET',
      LIVEKIT_SIP_PASSWORD: process.env.LIVEKIT_SIP_PASSWORD ? 'SET' : 'NOT SET',
    }
  })
}