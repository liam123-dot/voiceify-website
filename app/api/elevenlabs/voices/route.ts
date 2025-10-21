import { NextResponse } from 'next/server'
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVEN_API_KEY,
});

/**
 * GET /api/elevenlabs/voices
 * Fetches all available voices from ElevenLabs account
 */
export async function GET() {
  try {
    const voices = await elevenlabs.voices.getAll()
    
    // Map to a simpler format
    const voiceList = voices.voices.map(voice => ({
      voiceId: voice.voiceId,
      name: voice.name,
      description: voice.description || null,
      category: voice.category || null,
      labels: voice.labels || {},
      previewUrl: voice.previewUrl || null,
    }))

    return NextResponse.json({ voices: voiceList })
  } catch (error) {
    console.error('Error fetching voices from ElevenLabs:', error)
    
    const err = error as { message?: string }
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch voices from ElevenLabs' },
      { status: 500 }
    )
  }
}

