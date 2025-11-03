import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthSession } from '@/lib/auth'

interface RouteContext {
  params: Promise<{
    slug: string
    callId: string
  }>
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const supabase = await createServiceClient()
    const { slug, callId } = await context.params

    const { user, organizationId } = await getAuthSession(slug)

    // Fetch the call with organization_id and livekit_room_name
    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('id, organization_id, livekit_room_name')
      .eq('id', callId)
      .eq('organization_id', organizationId)
      .single()

    if (callError || !call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    if (call.organization_id !== organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Check if livekit_room_name exists
    if (!call.livekit_room_name) {
      return NextResponse.json({ error: 'Recording not available' }, { status: 404 })
    }

    // Construct the storage path: organization_id/livekit_room_name
    const storagePath = `${call.organization_id}/${call.livekit_room_name}.mp4`

    console.log('storagePath', storagePath)

    // Generate a signed URL for the recording (valid for 1 hour)
    const { data: signedUrlData, error: signedUrlError } = await supabase
      .storage
      .from('call-recordings')
      .createSignedUrl(storagePath, 3600) // 3600 seconds = 1 hour

    if (signedUrlError) {
      console.error('Error generating signed URL:', signedUrlError)
      return NextResponse.json({ error: 'Recording not found or not available yet' }, { status: 404 })
    }

    return NextResponse.json({ 
      recordingUrl: signedUrlData.signedUrl,
      expiresIn: 3600
    })
  } catch (error) {
    console.error('Error in GET /api/[slug]/calls/[callId]/recording:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

