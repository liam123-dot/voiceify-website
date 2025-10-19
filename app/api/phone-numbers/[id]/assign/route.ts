import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthSession } from '@/lib/auth'
import { SipClient } from 'livekit-server-sdk'
import { RoomConfiguration, RoomAgentDispatch } from '@livekit/protocol'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id: phoneNumberId } = await context.params
    const { user, organizationId } = await getAuthSession()

    if (!user || !organizationId) {
      return NextResponse.json(
        { error: 'Not authenticated or no organization found' },
        { status: 401 }
      )
    }

    const supabase = await createClient()

    // Parse request body
    const body = await request.json()
    const { agentId } = body

    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      )
    }

    // Verify the phone number belongs to the user's organization
    const { data: phoneNumber, error: phoneError } = await supabase
      .from('phone_numbers')
      .select('*')
      .eq('id', phoneNumberId)
      .eq('organization_id', organizationId)
      .single()

    if (phoneError || !phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number not found' },
        { status: 404 }
      )
    }

    // Verify the agent belongs to the user's organization
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, name')
      .eq('id', agentId)
      .eq('organization_id', organizationId)
      .single()

    if (agentError || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Check if phone number is already assigned to a different agent
    if (phoneNumber.agent_id && phoneNumber.agent_id !== agentId) {
      return NextResponse.json(
        { error: 'Phone number is already assigned to another agent' },
        { status: 400 }
      )
    }

    // ============================================
    // ENSURE LIVEKIT DISPATCH RULE EXISTS
    // ============================================
    const livekitUrl = process.env.LIVEKIT_URL
    const livekitApiKey = process.env.LIVEKIT_API_KEY
    const livekitApiSecret = process.env.LIVEKIT_API_SECRET

    if (livekitUrl && livekitApiKey && livekitApiSecret) {
      try {
        const sipClient = new SipClient(livekitUrl, livekitApiKey, livekitApiSecret)

        // Check if a dispatch rule already exists
        const existingRules = await sipClient.listSipDispatchRule()
        
        if (!existingRules || existingRules.length === 0) {
          // Create a single dispatch rule for all incoming calls
          const dispatchRule = await sipClient.createSipDispatchRule(
            {
              type: 'individual',
              roomPrefix: 'call-',
              pin: '', // No PIN required
            },
            {
              name: 'Voiceify Dispatch Rule',
              metadata: JSON.stringify({
                organizationId: organizationId,
              }),
              roomConfig: new RoomConfiguration({
                metadata: JSON.stringify({
                  organizationId: organizationId,
                }),
              }),
              trunkIds: [], // Empty means all trunks
              hidePhoneNumber: false,
            }
          )

          console.log('Created LiveKit dispatch rule:', dispatchRule.sipDispatchRuleId)
        } else {
          console.log('Dispatch rule already exists, reusing:', existingRules[0].sipDispatchRuleId)
        }
      } catch (livekitError) {
        console.error('Failed to ensure LiveKit dispatch rule exists:', livekitError)
        return NextResponse.json(
          { error: 'Failed to configure LiveKit dispatch rule' },
          { status: 500 }
        )
      }
    }

    // Assign the phone number to the agent
    const { data: updatedPhoneNumber, error: updateError } = await supabase
      .from('phone_numbers')
      .update({ agent_id: agentId })
      .eq('id', phoneNumberId)
      .select()
      .single()

    if (updateError) {
      console.error('Error assigning phone number:', updateError)
      return NextResponse.json(
        { error: 'Failed to assign phone number' },
        { status: 500 }
      )
    }

    return NextResponse.json({ phoneNumber: updatedPhoneNumber })
  } catch (error) {
    console.error('Error in /api/phone-numbers/[id]/assign POST:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id: phoneNumberId } = await context.params
    const { user, organizationId } = await getAuthSession()

    if (!user || !organizationId) {
      return NextResponse.json(
        { error: 'Not authenticated or no organization found' },
        { status: 401 }
      )
    }

    const supabase = await createClient()

    // Verify the phone number belongs to the user's organization
    const { data: phoneNumber, error: phoneError } = await supabase
      .from('phone_numbers')
      .select('*')
      .eq('id', phoneNumberId)
      .eq('organization_id', organizationId)
      .single()

    if (phoneError || !phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number not found' },
        { status: 404 }
      )
    }

    // Unassign the phone number (dispatch rule and trunk remain for reuse)
    const { data: updatedPhoneNumber, error: updateError } = await supabase
      .from('phone_numbers')
      .update({ 
        agent_id: null,
        webhook_configured: false,
        webhook_url: null,
      })
      .eq('id', phoneNumberId)
      .select()
      .single()

    if (updateError) {
      console.error('Error unassigning phone number:', updateError)
      return NextResponse.json(
        { error: 'Failed to unassign phone number' },
        { status: 500 }
      )
    }

    return NextResponse.json({ phoneNumber: updatedPhoneNumber })
  } catch (error) {
    console.error('Error in /api/phone-numbers/[id]/assign DELETE:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

