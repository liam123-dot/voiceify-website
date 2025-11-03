import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthSession } from '@/lib/auth'

interface TwilioIncomingPhoneNumber {
  phone_number: string
  friendly_name: string
  capabilities: {
    voice: boolean
    sms: boolean
    mms: boolean
  }
  [key: string]: unknown
}

type RouteContext = {
  params: Promise<{ slug: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params
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
    const { accountSid, authToken } = body

    // Validate input
    if (!accountSid || !authToken) {
      return NextResponse.json(
        { error: 'Account SID and Auth Token are required' },
        { status: 400 }
      )
    }

    // Validate Twilio credentials format
    if (!accountSid.startsWith('AC') || accountSid.length !== 34) {
      return NextResponse.json(
        { error: 'Invalid Account SID format' },
        { status: 400 }
      )
    }

    try {
      // Fetch incoming phone numbers from Twilio
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json`
      
      const response = await fetch(twilioUrl, {
        method: 'GET',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        
        if (response.status === 401) {
          return NextResponse.json(
            { error: 'Invalid Twilio credentials. Please check your Account SID and Auth Token.' },
            { status: 401 }
          )
        }
        
        throw new Error(errorData.message || 'Failed to fetch numbers from Twilio')
      }

      const data = await response.json()
      
      // Get existing phone numbers from database (check globally, not just this org)
      const { data: existingNumbers, error: existingNumbersError } = await supabase
        .from('phone_numbers')
        .select('phone_number')

      if (existingNumbersError) {
        console.error('Error fetching existing phone numbers:', existingNumbersError)
        // Continue anyway, we'll just show all numbers
      }

      // Create a Set of existing phone numbers for efficient lookup
      const existingPhoneNumbers = new Set(
        existingNumbers?.map((n) => n.phone_number) || []
      )
      
      // Transform Twilio response to our format and filter out existing numbers
      const numbers = data.incoming_phone_numbers
        ?.filter((number: TwilioIncomingPhoneNumber) => 
          !existingPhoneNumbers.has(number.phone_number)
        )
        .map((number: TwilioIncomingPhoneNumber) => ({
          phoneNumber: number.phone_number,
          friendlyName: number.friendly_name,
          region: number.phone_number.substring(0, 2) === '+1' ? 'US/Canada' : 'International',
          capabilities: {
            voice: number.capabilities?.voice || false,
            sms: number.capabilities?.sms || false,
            mms: number.capabilities?.mms || false,
          },
        })) || []

      return NextResponse.json({ 
        numbers,
        count: numbers.length 
      })
    } catch (twilioError) {
      console.error('Twilio API error:', twilioError)
      
      const errorMessage = twilioError instanceof Error 
        ? twilioError.message 
        : 'Failed to connect to Twilio'
      
      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error in /api/[slug]/phone-numbers/twilio/available POST:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

