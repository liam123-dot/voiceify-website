import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthSession } from '@/lib/auth'
import { configureTwilioWebhook } from '@/lib/twilio/client'

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

    if (!phoneNumber.agent_id) {
      return NextResponse.json(
        { error: 'Phone number must be assigned to an agent first' },
        { status: 400 }
      )
    }

    // Get the base URL from the request
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    const webhookUrl = `${baseUrl}/api/calls/incoming`

    let webhookConfigured = false

    // Configure webhook based on provider
    switch (phoneNumber.provider) {
      case 'twilio':
        try {
          const credentials = phoneNumber.credentials as { accountSid: string; authToken: string }
          
          if (!credentials.accountSid || !credentials.authToken) {
            throw new Error('Missing Twilio credentials')
          }

          const result = await configureTwilioWebhook(
            credentials.accountSid,
            credentials.authToken,
            phoneNumber.phone_number,
            webhookUrl
          )

          if (!result.success) {
            throw new Error(result.error || 'Failed to configure Twilio webhook')
          }

          webhookConfigured = true
        } catch (twilioError) {
          console.error('Twilio webhook configuration error:', twilioError)
          throw new Error(
            twilioError instanceof Error 
              ? twilioError.message 
              : 'Failed to configure Twilio webhook'
          )
        }
        break

      default:
        return NextResponse.json(
          { error: `Provider ${phoneNumber.provider} is not supported yet` },
          { status: 400 }
        )
    }

    // Update the phone number with webhook configuration
    const { data: updatedPhoneNumber, error: updateError } = await supabase
      .from('phone_numbers')
      .update({
        webhook_configured: webhookConfigured,
        webhook_url: webhookUrl,
        last_verified_at: new Date().toISOString(),
      })
      .eq('id', phoneNumberId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating phone number:', updateError)
      return NextResponse.json(
        { error: 'Failed to update phone number' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      phoneNumber: updatedPhoneNumber,
      webhookUrl 
    })
  } catch (error) {
    console.error('Error in /api/phone-numbers/[id]/configure-webhook POST:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}

