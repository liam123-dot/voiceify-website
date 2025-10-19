import { NextResponse } from 'next/server'
import { REALTIME_MODEL_PRICING } from '@/lib/pricing'
import { STT_MODELS, LLM_MODELS, TTS_MODELS } from '@/lib/models'

export async function GET() {
  return NextResponse.json({
    sttModels: STT_MODELS,
    llmModels: LLM_MODELS,
    ttsModels: TTS_MODELS,
    realtimePricing: REALTIME_MODEL_PRICING,
    lastUpdated: '2025-01-14',
    note: 'Prices are based on LiveKit Inference pricing. All prices are in USD. Check https://livekit.io/pricing/inference for latest pricing.',
  })
}
