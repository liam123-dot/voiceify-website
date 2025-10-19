import { 
  getLLMModel, 
  getSTTModel, 
  getTTSModel,
  type LLMModel,
  type STTModel,
  type TTSModel 
} from './models';

/**
 * Pricing for OpenAI Realtime Models
 * These models use a different pricing structure with audio and text tokens
 * Source: https://openai.com/pricing
 */
export const REALTIME_MODEL_PRICING = {
  'gpt-realtime-mini': {
    audioInputTokens: 10,           // $10.00 per 1M tokens
    audioOutputTokens: 20,          // $20.00 per 1M tokens
    audioCachedTokens: 0.30,        // $0.30 per 1M tokens
    textInputTokens: 0.60,          // $0.60 per 1M tokens
    textOutputTokens: 2.40,         // $2.40 per 1M tokens
    textCachedTokens: 0.06,         // $0.06 per 1M tokens
  },
  'gpt-realtime': {
    audioInputTokens: 32,
    audioOutputTokens: 64,
    audioCachedTokens: 0.50,
    textInputTokens: 4,
    textOutputTokens: 16,
    textCachedTokens: 0.5,
  },
  'gpt-4o-realtime-preview': {
    audioInputTokens: 10,
    audioOutputTokens: 20,
    audioCachedTokens: 0.30,
    textInputTokens: 2.50,
    textOutputTokens: 10.00,
    textCachedTokens: 1.25,
  },
  'gpt-4o-mini-realtime-preview': {
    audioInputTokens: 10,
    audioOutputTokens: 20,
    audioCachedTokens: 0.30,
    textInputTokens: 0.60,
    textOutputTokens: 2.40,
    textCachedTokens: 0.06,
  },
}

/**
 * Helper function to extract model IDs from agent configuration
 * Returns LiveKit format model IDs for pricing lookup
 */
export function extractConfigDetails(config: Record<string, unknown> | null | undefined): {
  llmModelId: string
  sttModelId: string
  ttsModelId: string
} {
  if (!config) {
    return { 
      llmModelId: 'openai/gpt-4o-mini', 
      sttModelId: 'deepgram/nova-2-phonecall',
      ttsModelId: 'elevenlabs/eleven_flash_v2_5'
    }
  }

  let llmModelId: string
  let sttModelId: string
  let ttsModelId: string

  if (config.pipelineType === 'realtime') {
    // Realtime mode: extract from realtimeModel
    const realtimeModel = config.realtimeModel as { model?: string } | undefined
    llmModelId = realtimeModel?.model || 'gpt-realtime-mini'
    sttModelId = 'openai-realtime' // Realtime uses built-in STT (not in our pricing models)
    ttsModelId = 'openai-realtime' // Realtime uses built-in TTS (not in our pricing models)
  } else if (config.pipelineType === 'pipeline') {
    // Pipeline mode: models are already in LiveKit format
    const pipeline = config.pipeline as { 
      llm?: { model?: string }
      stt?: { model?: string }
      tts?: { model?: string }
    } | undefined
    llmModelId = pipeline?.llm?.model || 'openai/gpt-4o-mini'
    sttModelId = pipeline?.stt?.model || 'deepgram/nova-2-phonecall'
    
    // TTS model format: "provider/model:voiceId"
    // Extract just "provider/model" for pricing lookup
    if (pipeline?.tts?.model) {
      const ttsModel = pipeline.tts.model
      // Split by ':' to remove voice ID
      ttsModelId = (ttsModel as string).split(':')[0]
    } else {
      ttsModelId = 'elevenlabs/eleven_flash_v2_5'
    }
  } else {
    // Fallback to legacy flat structure
    llmModelId = (config.model as string | undefined) || 'openai/gpt-4o-mini'
    sttModelId = 'deepgram/nova-2-phonecall'
    ttsModelId = 'elevenlabs/eleven_flash_v2_5'
  }

  return { llmModelId, sttModelId, ttsModelId }
}

/**
 * Calculate the cost of a call based on usage metrics
 */
export function calculateCallCost(
  usageMetrics: {
    llmPromptTokens: number
    llmPromptCachedTokens: number
    llmCompletionTokens: number
    audioInputTokens?: number
    audioOutputTokens?: number
    ttsCharactersCount: number
    sttAudioDuration: number
    totalTokens?: number
  },
  llmModelId: string,
  sttModelId: string,
  ttsModelId: string
): {
  llmCost: number
  ttsCost: number
  sttCost: number
  totalCost: number
  breakdown: {
    llm: { [key: string]: number }
    tts: number
    stt: number
  }
} {
  let llmCost = 0
  const llmBreakdown: { [key: string]: number } = {}

  // Check if it's a realtime model (has different pricing structure)
  const realtimePricing = REALTIME_MODEL_PRICING[llmModelId as keyof typeof REALTIME_MODEL_PRICING]
  
  if (realtimePricing) {
    // Realtime model pricing
    if (usageMetrics.audioInputTokens && usageMetrics.audioInputTokens > 0) {
      llmBreakdown.audioInput = (usageMetrics.audioInputTokens / 1_000_000) * realtimePricing.audioInputTokens
      llmCost += llmBreakdown.audioInput
    }
    if (usageMetrics.audioOutputTokens && usageMetrics.audioOutputTokens > 0) {
      llmBreakdown.audioOutput = (usageMetrics.audioOutputTokens / 1_000_000) * realtimePricing.audioOutputTokens
      llmCost += llmBreakdown.audioOutput
    }
    // For realtime models, llmPromptTokens are the non-cached text tokens
    const nonCachedPromptTokens = usageMetrics.llmPromptTokens - usageMetrics.llmPromptCachedTokens
    if (nonCachedPromptTokens > 0) {
      llmBreakdown.textInput = (nonCachedPromptTokens / 1_000_000) * realtimePricing.textInputTokens
      llmCost += llmBreakdown.textInput
    }
    // Cached text tokens for realtime models
    if (usageMetrics.llmPromptCachedTokens > 0) {
      llmBreakdown.textCached = (usageMetrics.llmPromptCachedTokens / 1_000_000) * realtimePricing.textCachedTokens
      llmCost += llmBreakdown.textCached
    }
    if (usageMetrics.llmCompletionTokens > 0) {
      llmBreakdown.textOutput = (usageMetrics.llmCompletionTokens / 1_000_000) * realtimePricing.textOutputTokens
      llmCost += llmBreakdown.textOutput
    }
  } else {
    // Standard pipeline model pricing
    const llmModel = getLLMModel(llmModelId)
    if (llmModel) {
      // For pipeline models, separate cached from non-cached tokens
      const nonCachedPromptTokens = usageMetrics.llmPromptTokens - usageMetrics.llmPromptCachedTokens
      if (nonCachedPromptTokens > 0) {
        llmBreakdown.input = (nonCachedPromptTokens / 1_000_000) * llmModel.inputPricePerMillion
        llmCost += llmBreakdown.input
      }
      if (usageMetrics.llmPromptCachedTokens > 0 && llmModel.cachedInputPricePerMillion) {
        llmBreakdown.cachedInput = (usageMetrics.llmPromptCachedTokens / 1_000_000) * llmModel.cachedInputPricePerMillion
        llmCost += llmBreakdown.cachedInput
      }
      if (usageMetrics.llmCompletionTokens > 0) {
        llmBreakdown.output = (usageMetrics.llmCompletionTokens / 1_000_000) * llmModel.outputPricePerMillion
        llmCost += llmBreakdown.output
      }
    }
  }

  // Calculate TTS cost
  let ttsCost = 0
  const ttsModel = getTTSModel(ttsModelId)
  if (ttsModel && usageMetrics.ttsCharactersCount > 0) {
    ttsCost = (usageMetrics.ttsCharactersCount / 1_000_000) * ttsModel.pricePerMillionChars
  }

  // Calculate STT cost (duration is in seconds)
  let sttCost = 0
  const sttModel = getSTTModel(sttModelId)
  if (sttModel && usageMetrics.sttAudioDuration > 0) {
    sttCost = (usageMetrics.sttAudioDuration / 3600) * sttModel.pricePerHour
  }

  const totalCost = llmCost + ttsCost + sttCost

  return {
    llmCost,
    ttsCost,
    sttCost,
    totalCost,
    breakdown: {
      llm: llmBreakdown,
      tts: ttsCost,
      stt: sttCost,
    },
  }
}

// Helper to format currency
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  }).format(amount)
}

