/**
 * Agent Configuration Types
 * 
 * These types define the structure of agent configurations stored in the database
 * and used by the LiveKit agent to configure the voice pipeline.
 * 
 * Based on LiveKit Agents framework documentation:
 * - https://docs.livekit.io/agents/build/
 * - https://docs.livekit.io/agents/models/
 * - https://docs.livekit.io/agents/models/realtime/
 */

export type PipelineType = 'realtime' | 'pipeline';

export type RealtimeProvider = 'openai' | 'azure-openai' | 'gemini' | 'nova-sonic';

export type TurnDetectionType = 'multilingual' | 'server-vad' | 'disabled';

export type VADProvider = 'silero' | 'livekit';

export type NoiseCancellationType = 'bvc' | 'krisp';

export type Modality = 'text' | 'audio';

/**
 * Configuration for realtime speech-to-speech models
 * Used when pipelineType is 'realtime'
 */
export interface RealtimeModelConfig {
  provider: RealtimeProvider;
  model: string; // e.g., "gpt-realtime-mini", "gpt-realtime-mini-2024-10-01"
  voice: string; // e.g., "alloy", "echo", "shimmer", "coral", "verse"
  temperature?: number; // 0.0 to 1.0
  modalities?: Modality[]; // Response modalities (text, audio, or both)
  apiKey?: string; // Optional custom API key
  apiEndpoint?: string; // Optional custom endpoint
}

/**
 * Speech-to-Text configuration for pipeline mode
 * Uses LiveKit Inference format: "provider/model"
 * Example: "deepgram/nova-2-phonecall", "assemblyai/universal-streaming"
 */
export interface STTConfig {
  provider: 'deepgram' | 'assemblyai' | 'cartesia'; // STT provider
  model: string; // LiveKit format: e.g., "deepgram/nova-2-phonecall", "assemblyai/universal-streaming"
  inferenceType?: 'livekit' | 'direct'; // Whether to use LiveKit Inference or direct plugin (default: 'livekit')
  language?: string; // Language code (e.g., "en", "es", "fr")
  apiKey?: string; // Optional custom API key
}

/**
 * Language Model configuration for pipeline mode
 * Uses LiveKit Inference format: "provider/model"
 * Example: "openai/gpt-4o-mini", "google/gemini-2.5-flash"
 */
export interface LLMConfig {
  provider: 'openai' | 'azure' | 'google' | 'baseten' | 'groq' | 'cerebras'; // LLM provider
  model: string; // LiveKit format: e.g., "openai/gpt-4o-mini", "google/gemini-2.5-flash"
  inferenceType?: 'livekit' | 'direct'; // Whether to use LiveKit Inference or direct plugin (default: 'livekit')
  temperature?: number; // 0.0 to 1.0
  maxTokens?: number; // Maximum tokens in response
  apiKey?: string; // Optional custom API key
  apiEndpoint?: string; // Optional custom endpoint
}

/**
 * Text-to-Speech configuration for pipeline mode or realtime with separate TTS
 * Uses LiveKit Inference format: "provider/model:voiceId"
 * Example: "elevenlabs/eleven_flash_v2_5:EXAVITQu4vr4xnSDxMaL", "inworld/inworld-tts-1:Olivia"
 */
export interface TTSConfig {
  model: string; // LiveKit format: "provider/model:voiceId"
  inferenceType?: 'livekit' | 'direct'; // Whether to use LiveKit Inference or direct plugin (default: 'livekit')
  speed?: number; // 0.7 to 1.2, default 1.0
  stability?: number; // ElevenLabs: 0.25 to 1.0, controls consistency (default 0.5)
  similarity_boost?: number; // ElevenLabs: 0.0 to 1.0, controls voice matching (default 0.75)
  style?: number; // ElevenLabs: 0.0 to 0.75, controls expressiveness (default 0.0)
  use_speaker_boost?: boolean; // ElevenLabs: enhances similarity to original speaker (default true)
  apiKey?: string;
}

/**
 * Pipeline configuration for STT-LLM-TTS mode
 * Used when pipelineType is 'pipeline'
 */
export interface PipelineConfig {
  stt?: STTConfig; // Required for pipeline mode
  llm?: LLMConfig; // Required for pipeline mode
  tts?: TTSConfig; // Required for pipeline mode or optional for realtime with separate TTS
}

/**
 * Voice Activity Detection options
 */
export interface VADOptions {
  minSpeechDuration?: number; // Minimum speech duration in milliseconds
  silenceTimeout?: number; // Silence timeout in milliseconds
  prefixPadding?: number; // Audio padding before speech in milliseconds
  silenceThreshold?: number; // Silence threshold (0.0 to 1.0)
}

/**
 * Turn detection and VAD configuration
 */
export interface TurnDetectionConfig {
  type: TurnDetectionType;
  vadProvider?: VADProvider; // Voice Activity Detection provider
  vadOptions?: VADOptions;
}

/**
 * Noise cancellation configuration
 */
export interface NoiseCancellationConfig {
  enabled: boolean;
  type?: NoiseCancellationType; // Background Voice Cancellation type
}

/**
 * Tool definition for agent capabilities
 */
export interface AgentTool {
  id: string;
  name: string;
  description: string;
  parameters?: Record<string, any>;
  enabled: boolean;
}

/**
 * Additional agent settings
 */
export interface AgentSettings {
  enableTranscription?: boolean; // Enable/disable transcription
  recordSession?: boolean; // Record the session
  maxDuration?: number; // Maximum session duration in seconds
  interruptible?: boolean; // Whether the agent can be interrupted
  generateFirstMessage?: boolean; // Generate a greeting message when user connects
  firstMessageType?: 'direct' | 'generated'; // Type of first message: direct text or AI-generated
  firstMessage?: string; // Direct first message text (used when firstMessageType is 'direct')
  firstMessagePrompt?: string; // Custom prompt for generating the first message (used when firstMessageType is 'generated')
  firstMessageAllowInterruptions?: boolean; // Whether the first message can be interrupted
}

/**
 * Complete agent configuration
 * This is the main configuration object stored in the database
 */
export interface AgentConfiguration {
  // Pipeline type: "realtime" for direct speech-to-speech or "pipeline" for STT-LLM-TTS
  pipelineType: PipelineType;
  
  // Instructions for the agent (system prompt)
  instructions: string;
  
  // Realtime model configuration (used when pipelineType = "realtime")
  realtimeModel?: RealtimeModelConfig;
  
  // Pipeline configuration (used when pipelineType = "pipeline" or for separate TTS with realtime)
  pipeline?: PipelineConfig;
  
  // Turn detection and VAD configuration
  turnDetection?: TurnDetectionConfig;
  
  // Noise cancellation configuration
  noiseCancellation?: NoiseCancellationConfig;
  
  // Tools configuration (empty for now, but ready for future use)
  tools?: AgentTool[];
  
  // Additional settings
  settings?: AgentSettings;
}

/**
 * Sample configurations for different use cases
 */
export const SAMPLE_CONFIGS = {
  /**
   * Realtime model configuration
   * Best for: Natural conversations with emotional understanding
   */
  realtime: {
    pipelineType: 'realtime' as PipelineType,
    instructions: 'You are a helpful customer support agent. Be friendly, professional, and concise in your responses. Always greet users warmly and ask how you can help them today.',
    realtimeModel: {
      provider: 'openai' as RealtimeProvider,
      model: 'gpt-realtime-mini',
      voice: 'alloy',
      temperature: 0.8,
      modalities: ['audio' as Modality]
    },
    turnDetection: {
      type: 'server-vad' as TurnDetectionType,
      vadProvider: 'silero' as VADProvider,
      vadOptions: {
        minSpeechDuration: 200,
        silenceTimeout: 800,
        prefixPadding: 300,
        silenceThreshold: 0.5
      }
    },
    noiseCancellation: {
      enabled: true,
      type: 'bvc' as NoiseCancellationType
    },
    tools: [],
    settings: {
      enableTranscription: true,
      recordSession: true,
      interruptible: true
    }
  } satisfies AgentConfiguration,

  /**
   * Pipeline configuration with separate STT, LLM, and TTS
   * Best for: Maximum control and flexibility over each component
   */
  pipeline: {
    pipelineType: 'pipeline' as PipelineType,
    instructions: 'You are a sales assistant for an e-commerce company. Help customers find products and answer their questions.',
    pipeline: {
      stt: {
        provider: 'deepgram',
        model: 'deepgram/nova-2-phonecall',
        language: 'en'
      },
      llm: {
        provider: 'openai',
        model: 'openai/gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 500
      },
      tts: {
        model: 'elevenlabs/eleven_turbo_v2_5:EXAVITQu4vr4xnSDxMaL',
        speed: 1.0
      }
    },
    turnDetection: {
      type: 'multilingual' as TurnDetectionType,
      vadProvider: 'silero' as VADProvider
    },
    noiseCancellation: {
      enabled: true,
      type: 'bvc' as NoiseCancellationType
    },
    tools: [],
    settings: {
      enableTranscription: true,
      recordSession: false,
      maxDuration: 3600,
      interruptible: true
    }
  } satisfies AgentConfiguration,

  /**
   * Realtime model with separate TTS
   * Best for: Emotional understanding with custom voice output
   */
  realtimeWithTTS: {
    pipelineType: 'realtime' as PipelineType,
    instructions: 'You are a meditation guide. Speak slowly and calmly to help users relax.',
    realtimeModel: {
      provider: 'openai' as RealtimeProvider,
      model: 'gpt-realtime-mini',
      voice: 'coral',
      temperature: 0.9,
      modalities: ['text' as Modality] // Use text modality to enable separate TTS
    },
    pipeline: {
      tts: {
        model: 'elevenlabs/eleven_turbo_v2_5:EXAVITQu4vr4xnSDxMaL',
        speed: 0.9
      }
    },
    turnDetection: {
      type: 'multilingual' as TurnDetectionType,
      vadProvider: 'silero' as VADProvider
    },
    noiseCancellation: {
      enabled: true,
      type: 'bvc' as NoiseCancellationType
    },
    tools: [],
    settings: {
      enableTranscription: true,
      recordSession: true,
      interruptible: false
    }
  } satisfies AgentConfiguration
};

