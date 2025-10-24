import type { Control } from 'react-hook-form'
import * as z from 'zod'

// Voice interface
export interface Voice {
  voiceId: string
  name: string
  description: string | null
  category: string | null
  labels: Record<string, string>
  previewUrl: string | null
}

// Form schema
export const formSchema = z.object({
  pipelineType: z.enum(['realtime', 'pipeline']),
  instructions: z.string().min(10, 'Instructions must be at least 10 characters'),
  
  // Realtime fields - use union to allow any string when not in realtime mode
  realtimeVoice: z.union([
    z.enum(['alloy', 'echo', 'shimmer', 'coral', 'verse']),
    z.string(),
  ]).optional(),
  realtimeModel: z.union([
    z.enum(['gpt-realtime', 'gpt-realtime-mini']),
    z.string(),
  ]).optional(),
  
  // Pipeline fields
  sttModel: z.string().optional(), // LiveKit format: "deepgram/nova-2-phonecall"
  sttInferenceType: z.enum(['livekit', 'direct']).optional(),
  llmModel: z.string().optional(), // LiveKit format: "openai/gpt-4o-mini"
  llmInferenceType: z.enum(['livekit', 'direct']).optional(),
  llmTemperature: z.number().min(0).max(1).optional(),
  ttsModelId: z.string().optional(), // LiveKit format: "elevenlabs/eleven_flash_v2_5"
  ttsVoiceId: z.string().optional(), // Voice ID: "EXAVITQu4vr4xnSDxMaL"
  ttsInferenceType: z.enum(['livekit', 'direct']).optional(),
  
  // ElevenLabs advanced TTS settings
  ttsStability: z.number().min(0.25).max(1).optional(),
  ttsSimilarityBoost: z.number().min(0).max(1).optional(),
  ttsStyle: z.number().min(0).max(0.75).optional(),
  ttsUseSpeakerBoost: z.boolean().optional(),
  ttsSpeed: z.number().min(0.7).max(1.2).optional(),
  
  // Common fields
  enableTranscription: z.boolean(),
  recordSession: z.boolean(),
  interruptible: z.boolean(),
  noiseCancellation: z.boolean(),
  generateFirstMessage: z.boolean(),
  firstMessageType: z.enum(['direct', 'generated']).optional(),
  firstMessage: z.string().optional(),
  firstMessagePrompt: z.string().optional(),
  firstMessageAllowInterruptions: z.boolean(),
  
  // Turn detection and VAD configuration
  turnDetectionType: z.enum(['multilingual', 'server-vad', 'disabled']).optional(),
  vadMinSpeechDuration: z.number().min(10).max(500).optional(),
  vadMinSilenceDuration: z.number().min(100).max(2000).optional(),
  vadPrefixPaddingDuration: z.number().min(0).max(1000).optional(),
  turnDetectorMinEndpointingDelay: z.number().min(0).max(2000).optional(),
  turnDetectorMaxEndpointingDelay: z.number().min(1000).max(10000).optional(),
  
  // Knowledge base configuration
  knowledgeBaseUseAsTool: z.boolean().optional(),
  knowledgeBaseMatchCount: z.number().min(1).max(10).optional(),

  // Background noise configuration
  backgroundNoiseEnabled: z.boolean().optional(),
}).superRefine((data, ctx) => {
  // Validate realtime fields when pipeline type is realtime
  if (data.pipelineType === 'realtime') {
    if (!data.realtimeVoice || !['alloy', 'echo', 'shimmer', 'coral', 'verse'].includes(data.realtimeVoice)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Valid voice is required for realtime mode',
        path: ['realtimeVoice'],
      })
    }
    if (!data.realtimeModel || !['gpt-realtime', 'gpt-realtime-mini'].includes(data.realtimeModel)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Valid model is required for realtime mode',
        path: ['realtimeModel'],
      })
    }
  }
  
  // Validate pipeline fields when pipeline type is pipeline
  if (data.pipelineType === 'pipeline') {
    if (!data.sttModel) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'STT model is required for pipeline mode',
        path: ['sttModel'],
      })
    }
    if (!data.llmModel) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'LLM model is required for pipeline mode',
        path: ['llmModel'],
      })
    }
    if (!data.ttsModelId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'TTS model is required for pipeline mode',
        path: ['ttsModelId'],
      })
    }
    if (!data.ttsVoiceId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Voice selection is required for pipeline mode',
        path: ['ttsVoiceId'],
      })
    }
  }
  
  // Validate first message fields when first message is enabled
  if (data.generateFirstMessage) {
    if (data.firstMessageType === 'direct' && !data.firstMessage?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'First message text is required when using direct message type',
        path: ['firstMessage'],
      })
    }
    if (data.firstMessageType === 'generated' && !data.firstMessagePrompt?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'First message prompt is required when using generated message type',
        path: ['firstMessagePrompt'],
      })
    }
  }
})

export type FormValues = z.infer<typeof formSchema>

// Component prop types
export interface VoiceSelectorProps {
  control: Control<FormValues>
  availableVoices: Voice[]
  isLoadingVoices: boolean
  voicesError: string | null
  playingVoiceId: string | null
  selectedAccent: string
  selectedLanguage: string
  isVoiceListOpen: boolean
  onFetchVoices: () => void
  onPlayVoicePreview: (voiceId: string, previewUrl: string | null) => void
  onAccentChange: (accent: string) => void
  onLanguageChange: (language: string) => void
  onVoiceListOpenChange: (open: boolean) => void
}

export interface AdvancedTTSSettingsProps {
  control: Control<FormValues>
  ttsStability?: number
  ttsSimilarityBoost?: number
  ttsStyle?: number
  ttsSpeed?: number
}

export interface TurnDetectionSettingsProps {
  control: Control<FormValues>
  turnDetectionType?: string
  vadMinSpeechDuration?: number
  vadMinSilenceDuration?: number
  vadPrefixPaddingDuration?: number
  turnDetectorMinEndpointingDelay?: number
  turnDetectorMaxEndpointingDelay?: number
}

export interface KnowledgeBaseSettingsProps {
  control: Control<FormValues>
  knowledgeBaseMatchCount?: number
}

export interface STTSectionProps {
  control: Control<FormValues>
  sttModel?: string
  keywords: string[]
  onManageKeywords: () => void
}

export interface LLMSectionProps {
  control: Control<FormValues>
  llmTemperature?: number
}

export interface TTSSectionProps {
  control: Control<FormValues>
  ttsVoiceId?: string
  ttsStability?: number
  ttsSimilarityBoost?: number
  ttsStyle?: number
  ttsSpeed?: number
  availableVoices: Voice[]
  isLoadingVoices: boolean
  voicesError: string | null
  playingVoiceId: string | null
  selectedAccent: string
  selectedLanguage: string
  isVoiceListOpen: boolean
  onFetchVoices: () => void
  onPlayVoicePreview: (voiceId: string, previewUrl: string | null) => void
  onAccentChange: (accent: string) => void
  onLanguageChange: (language: string) => void
  onVoiceListOpenChange: (open: boolean) => void
}

export interface SystemPromptCardProps {
  control: Control<FormValues>
}

export interface FirstMessageCardProps {
  control: Control<FormValues>
  generateFirstMessage: boolean
  firstMessageType?: string
}

export interface SessionSettingsCardProps {
  control: Control<FormValues>
}

export interface AudioProcessingCardProps {
  control: Control<FormValues>
}

