import { createServiceClient, createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import { SipClient } from 'livekit-server-sdk'
import { ListUpdate } from '@livekit/protocol'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const { user, organizationId } = await getAuthSession(slug)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createServiceClient()

    // Fetch phone numbers for the organization with agent information
    const { data: phoneNumbers, error } = await supabase
      .from('phone_numbers')
      .select('*, agents(id, name)')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching phone numbers:', error)
      return NextResponse.json({ error: 'Failed to fetch phone numbers' }, { status: 500 })
    }

    // Format the response to include agent as an object if it exists
    type PhoneNumberWithAgent = Record<string, unknown> & { agents?: { id: string; name: string } | null }
    const formattedPhoneNumbers = (phoneNumbers || []).map((pn: PhoneNumberWithAgent) => ({
      ...pn,
      agent: pn.agents || null,
      agents: undefined // Remove the joined field to avoid confusion
    }))

    return NextResponse.json({ phoneNumbers: formattedPhoneNumbers })
  } catch (error) {
    console.error('Error in GET /api/[slug]/phone-numbers:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const { user, organizationId } = await getAuthSession(slug)

    if (!user || !organizationId) {
      return NextResponse.json(
        { error: 'Not authenticated or no organization found' },
        { status: 401 }
      )
    }

    const supabase = await createClient()

    // Parse request body
    const body = await request.json()
    const { provider, phoneNumber, friendlyName, accountSid, authToken, metadata } = body

    // Validate input
    if (!provider || !phoneNumber) {
      return NextResponse.json(
        { error: 'Provider and phone number are required' },
        { status: 400 }
      )
    }

    if (provider === 'twilio' && (!accountSid || !authToken)) {
      return NextResponse.json(
        { error: 'Twilio Account SID and Auth Token are required' },
        { status: 400 }
      )
    }

    // Check if phone number already exists
    const { data: existingNumber } = await supabase
      .from('phone_numbers')
      .select('id')
      .eq('phone_number', phoneNumber)
      .eq('organization_id', organizationId)
      .single()

    if (existingNumber) {
      return NextResponse.json(
        { error: 'This phone number has already been added to your organization' },
        { status: 400 }
      )
    }

    // ============================================
    // CONFIGURE LIVEKIT SIP TRUNKS
    // ============================================
    const livekitUrl = process.env.LIVEKIT_URL
    const livekitApiKey = process.env.LIVEKIT_API_KEY
    const livekitApiSecret = process.env.LIVEKIT_API_SECRET

    if (!livekitUrl || !livekitApiKey || !livekitApiSecret) {
      return NextResponse.json(
        { error: 'LiveKit credentials not configured' },
        { status: 500 }
      )
    }

    let outboundTrunkId: string | undefined

    try {
      const sipClient = new SipClient(livekitUrl, livekitApiKey, livekitApiSecret)

      // ============================================
      // 1. INBOUND TRUNK (Twilio → LiveKit)
      // ============================================
      console.log('📥 Configuring inbound trunk (Twilio → LiveKit)...')
      
      // Get existing inbound trunks
      const inboundTrunks = await sipClient.listSipInboundTrunk()
      
      // Twilio's SIP signaling IPs (needed when forwarding through middleware)
      const twilioIPs = [
        '54.172.60.0',
        '54.244.51.0', 
        '54.171.127.192',
        '35.156.191.128',
        '54.65.63.192',
        '54.169.127.128',
        '54.252.254.64',
        '177.71.206.192'
      ]
      
      let inboundTrunk
      if (inboundTrunks && inboundTrunks.length > 0) {
        // Use the first inbound trunk
        inboundTrunk = inboundTrunks[0]
        
        // Add new number to the array if not already present
        if (!inboundTrunk.numbers?.includes(phoneNumber)) {
          await sipClient.updateSipInboundTrunkFields(inboundTrunk.sipTrunkId, {
            numbers: new ListUpdate({
              add: [phoneNumber]
            })
          })
          console.log('  ✅ Added phone number to existing inbound trunk:', inboundTrunk.sipTrunkId)
        } else {
          console.log('  ℹ️  Phone number already in inbound trunk:', inboundTrunk.sipTrunkId)
        }
      } else {
        // Create a new inbound trunk
        inboundTrunk = await sipClient.createSipInboundTrunk('Voiceify Inbound Trunk', [phoneNumber], {
          allowedAddresses: twilioIPs,
          krispEnabled: true,
          headersToAttributes: {  
            "X-Agent-ID": "agent.id",  
            "X-Agent-Name": "agent.name",   
            "X-Call-ID": "call.id",  
            "X-Phone-Number": "phone.number",  
            "X-Caller-ID": "caller.id",  
            "X-Call-SID": "call.sid"  
          }
        })
        console.log('  ✅ Created new inbound trunk:', inboundTrunk.sipTrunkId)
      }

      // ============================================
      // 2. CONFIGURE TWILIO TRUNK FOR SIP REFER TRANSFERS
      // Transfers happen via SIP REFER on the existing connection
      // ============================================
      if (provider === 'twilio' && accountSid && authToken) {
        console.log('📤 Configuring Twilio trunk for SIP REFER transfers...')
        
        // const { configureTwilioTrunkTransfers } = await import('@/lib/twilio/client')
        // const twilioTrunkResult = await configureTwilioTrunkTransfers(
        //   accountSid,
        //   authToken,
        //   phoneNumber
        // )
        
        // if (!twilioTrunkResult.success) {
        //   console.error('  ❌ Failed to configure Twilio trunk:', twilioTrunkResult.error)
        //   // Don't throw - phone number still works, just no transfers
        //   console.warn('  ⚠️  Phone number added but transfers may not work')
        // } else {
        //   console.log('  ✅ Twilio trunk configured for transfers:', twilioTrunkResult.trunkSid)
          
        //   // Store trunk SID in metadata for reference
        //   outboundTrunkId = twilioTrunkResult.trunkSid
        // }
      }
    } catch (livekitError) {
      console.error('Failed to configure LiveKit SIP trunks:', livekitError)
      return NextResponse.json(
        { error: 'Failed to configure number with LiveKit' },
        { status: 500 }
      )
    }


    // Prepare credentials (encrypted in production)
    const credentials = {
      accountSid,
      authToken,
    }

    // Prepare metadata with Twilio trunk info
    const enhancedMetadata = {
      ...(metadata || {}),
      twilioTrunkSid: outboundTrunkId, // Store Twilio trunk SID for reference
    }

    // Create the phone number record
    const { data: phoneNumberRecord, error: createError } = await supabase
      .from('phone_numbers')
      .insert({
        organization_id: organizationId,
        provider: provider,
        phone_number: phoneNumber,
        friendly_name: friendlyName || null,
        credentials: credentials,
        metadata: enhancedMetadata,
        status: 'active',
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating phone number:', createError)
      return NextResponse.json(
        { error: 'Failed to add phone number' },
        { status: 500 }
      )
    }

    console.log('\n✅ PHONE NUMBER CONFIGURATION COMPLETE')
    console.log('📞 Phone Number:', phoneNumber)
    console.log('📥 Inbound: LiveKit SIP trunk configured (Twilio → LiveKit)')
    console.log('📤 Outgoing: Phone voiceUrl webhook (for business logic)')
    if (outboundTrunkId) {
      console.log('🔄 Transfers: ENABLED via Twilio trunk', outboundTrunkId)
      console.log('   Transfer method: SIP REFER on existing connection')
    } else {
      console.log('⚠️  Transfers: NOT configured (Twilio trunk setup failed)')
    }

    return NextResponse.json({ phoneNumber: phoneNumberRecord }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/[slug]/phone-numbers:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

