import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthSession } from '@/lib/auth'
import { SipClient } from 'livekit-server-sdk'
import { ListUpdate } from '@livekit/protocol'

type RouteContext = {
  params: Promise<{ id: string }>
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

    // Get the phone number
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

    // ============================================
    // REMOVE NUMBER FROM LIVEKIT SIP TRUNK
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

    try {
      const sipClient = new SipClient(livekitUrl, livekitApiKey, livekitApiSecret)

      // Get existing trunks
      const trunks = await sipClient.listSipInboundTrunk()
      
      if (trunks && trunks.length > 0) {
        // Find the trunk that contains this phone number
        const trunk = trunks.find(t => t.numbers?.includes(phoneNumber.phone_number))
        
        if (trunk) {
          // Remove the phone number from the trunk
          await sipClient.updateSipInboundTrunkFields(trunk.sipTrunkId, {
            numbers: new ListUpdate({
              remove: [phoneNumber.phone_number]
            })
          })
          
          console.log('Removed phone number from SIP trunk:', trunk.sipTrunkId)
        } else {
          console.log('Phone number not found in any SIP trunk')
        }
      }
    } catch (livekitError) {
      console.error('Failed to remove number from LiveKit SIP trunk:', livekitError)
      // We'll continue with deletion even if LiveKit removal fails
      // Log the error but don't block the deletion
    }

    // ============================================
    // CLEAR TWILIO WEBHOOK (Optional)
    // ============================================
    if (phoneNumber.provider === 'twilio' && phoneNumber.webhook_configured) {
      try {
        const credentials = phoneNumber.credentials as { accountSid: string; authToken: string }
        
        if (credentials.accountSid && credentials.authToken) {
          // Get the phone number SID from Twilio
          const listUrl = `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(phoneNumber.phone_number)}`
          
          const listResponse = await fetch(listUrl, {
            method: 'GET',
            headers: {
              'Authorization': 'Basic ' + Buffer.from(`${credentials.accountSid}:${credentials.authToken}`).toString('base64'),
            },
          })

          if (listResponse.ok) {
            const listData = await listResponse.json()
            
            if (listData.incoming_phone_numbers && listData.incoming_phone_numbers.length > 0) {
              const phoneNumberSid = listData.incoming_phone_numbers[0].sid

              // Clear the phone number's voice webhook
              const updateUrl = `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/IncomingPhoneNumbers/${phoneNumberSid}.json`
              
              await fetch(updateUrl, {
                method: 'POST',
                headers: {
                  'Authorization': 'Basic ' + Buffer.from(`${credentials.accountSid}:${credentials.authToken}`).toString('base64'),
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                  VoiceUrl: '',
                  VoiceMethod: 'POST',
                }),
              })

              console.log('Cleared Twilio webhook for phone number')
            }
          }
        }
      } catch (twilioError) {
        console.error('Failed to clear Twilio webhook:', twilioError)
        // Continue with deletion even if webhook clearing fails
      }
    }

    // ============================================
    // DELETE DATABASE RECORD
    // ============================================
    const { error: deleteError } = await supabase
      .from('phone_numbers')
      .delete()
      .eq('id', phoneNumberId)
      .eq('organization_id', organizationId)

    if (deleteError) {
      console.error('Error deleting phone number:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete phone number' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true,
      message: 'Phone number deleted successfully' 
    })
  } catch (error) {
    console.error('Error in /api/phone-numbers/[id] DELETE:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}

