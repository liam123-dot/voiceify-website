import { NextRequest, NextResponse } from 'next/server'
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVEN_API_KEY,
});

/**
 * GET /api/elevenlabs/voice/[voiceId]
 * Fetches voice details from ElevenLabs API
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ voiceId: string }> }
) {
  try {
    const { voiceId } = await params
    console.log('voiceId', voiceId)

    if (!voiceId) {
      return NextResponse.json(
        { error: 'Voice ID is required' },
        { status: 400 }
      )
    }

    const voice = await elevenlabs.voices.get(voiceId)
    console.log('voice', voice)

    // Extract relevant metadata
    const metadata = {
      voiceId: voice.voiceId,
      name: voice.name,
      description: voice.description || null,
      category: voice.category || null,
      labels: voice.labels || {},
      previewUrl: voice.previewUrl || null,
      settings: voice.settings || null,
      sharingEnabled: voice.sharing?.status === 'enabled',
    }

    return NextResponse.json(metadata)
  } catch (error) {
    console.error('Error fetching voice from ElevenLabs:', error)
    
    // Handle 404 not found
    const err = error as { statusCode?: number; status?: number; message?: string }
    if (err?.statusCode === 404 || err?.status === 404) {
      return NextResponse.json(
        { error: 'Voice not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch voice from ElevenLabs' },
      { status: 500 }
    )
  }
}

