/**
 * Model definitions for voice agents
 * Based on LiveKit Inference API: https://livekit.io/pricing/inference
 */

export type ModelProvider = 
  | 'openai' 
  | 'azure' 
  | 'google' 
  | 'deepgram' 
  | 'assemblyai' 
  | 'cartesia' 
  | 'elevenlabs' 
  | 'inworld' 
  | 'rime'
  | 'baseten'
  | 'groq'
  | 'cerebras';

export type InferenceType = 'livekit' | 'direct';

// STT Model Definition
export interface STTModel {
  id: string; // LiveKit format: "provider/model"
  name: string;
  provider: ModelProvider;
  inferenceType: InferenceType;
  pricePerHour: number; // Price in USD per hour
  description?: string;
  features?: string[];
  recommended?: boolean;
}

// LLM Model Definition
export interface LLMModel {
  id: string; // LiveKit format: "provider/model"
  name: string;
  provider: ModelProvider;
  inferenceType: InferenceType;
  inputPricePerMillion: number; // Price in USD per 1M tokens
  outputPricePerMillion: number; // Price in USD per 1M tokens
  cachedInputPricePerMillion?: number; // Optional cached input price
  description?: string;
  features?: string[];
  recommended?: boolean;
}

// TTS Model Definition
export interface TTSModel {
  id: string; // LiveKit format: "provider/model" (voice is separate)
  name: string;
  provider: ModelProvider;
  inferenceType: InferenceType;
  pricePerMillionChars: number; // Price in USD per 1M characters
  description?: string;
  features?: string[];
  recommended?: boolean;
  voices?: TTSVoice[];
}

// Voice Definition for TTS
export interface TTSVoice {
  id: string;
  name: string;
  description?: string;
  language?: string;
  gender?: 'male' | 'female' | 'neutral';
}

/**
 * STT Models - Speech-to-Text
 * Source: https://livekit.io/pricing/inference#stt
 */
export const STT_MODELS: STTModel[] = [
  // Deepgram Models
  {
    id: 'deepgram/nova-3',
    name: 'Nova-3 (Monolingual)',
    provider: 'deepgram',
    inferenceType: 'livekit',
    pricePerHour: 0.462,
    description: 'Latest generation speech recognition for single language',
    features: ['High accuracy', 'Low latency', 'English optimized'],
  },
  {
    id: 'deepgram/nova-3-multilingual',
    name: 'Nova-3 (Multilingual)',
    provider: 'deepgram',
    inferenceType: 'livekit',
    pricePerHour: 0.552,
    description: 'Latest generation speech recognition with multi-language support',
    features: ['High accuracy', 'Multi-language', 'Low latency'],
  },
  {
    id: 'deepgram/nova-3-medical',
    name: 'Nova-3 Medical',
    provider: 'deepgram',
    inferenceType: 'livekit',
    pricePerHour: 0.462,
    description: 'Specialized for medical terminology and healthcare',
    features: ['Medical terminology', 'High accuracy', 'HIPAA ready'],
  },
  {
    id: 'deepgram/nova-2',
    name: 'Nova-2',
    provider: 'deepgram',
    inferenceType: 'livekit',
    pricePerHour: 0.348,
    description: 'Previous generation with excellent performance',
    features: ['Proven accuracy', 'Cost-effective'],
  },
  {
    id: 'deepgram/nova-2-medical',
    name: 'Nova-2 Medical',
    provider: 'deepgram',
    inferenceType: 'livekit',
    pricePerHour: 0.348,
    description: 'Medical-specialized previous generation model',
    features: ['Medical terminology', 'Cost-effective'],
  },
  {
    id: 'deepgram/nova-2-conversational-ai',
    name: 'Nova-2 Conversational AI',
    provider: 'deepgram',
    inferenceType: 'livekit',
    pricePerHour: 0.348,
    description: 'Optimized for conversational AI interactions',
    features: ['Conversation optimized', 'Natural dialogue'],
  },
  {
    id: 'deepgram/nova-2-phonecall',
    name: 'Nova-2 Phonecall',
    provider: 'deepgram',
    inferenceType: 'livekit',
    pricePerHour: 0.348,
    description: 'Specialized for phone call audio quality',
    features: ['Phone optimized', 'Noise resilient', 'Low bandwidth'],
    recommended: true,
  },
  // AssemblyAI
  {
    id: 'assemblyai/universal-streaming',
    name: 'Universal-Streaming',
    provider: 'assemblyai',
    inferenceType: 'livekit',
    pricePerHour: 0.150,
    description: 'Universal streaming transcription model',
    features: ['Real-time streaming', 'Cost-effective'],
  },
  // Cartesia
  {
    id: 'cartesia/ink-whisper',
    name: 'Ink Whisper',
    provider: 'cartesia',
    inferenceType: 'livekit',
    pricePerHour: 0.180,
    description: 'Cartesia\'s whisper-based transcription',
    features: ['Whisper technology', 'High quality'],
  },
];

/**
 * LLM Models - Large Language Models
 * Source: https://livekit.io/pricing/inference#llms
 */
export const LLM_MODELS: LLMModel[] = [
  // OpenAI Models (via Azure)
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    provider: 'azure',
    inferenceType: 'livekit',
    inputPricePerMillion: 2.50,
    outputPricePerMillion: 10.00,
    cachedInputPricePerMillion: 1.25,
    description: 'Most capable GPT-4 model with vision',
    features: ['High capability', 'Vision support', 'Fast'],
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'azure',
    inferenceType: 'livekit',
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.60,
    cachedInputPricePerMillion: 0.075,
    description: 'Fast and affordable GPT-4 model',
    features: ['Cost-effective', 'Fast', 'Reliable'],
    recommended: true,
  },
  {
    id: 'openai/gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    provider: 'azure',
    inferenceType: 'livekit',
    inputPricePerMillion: 0.40,
    outputPricePerMillion: 1.60,
    cachedInputPricePerMillion: 0.10,
    description: 'Efficient GPT-4.1 variant',
    features: ['Balanced performance', 'Cost-effective'],
  },
  // Groq Models
  {
    id: 'groq/llama-3.1-8b-instant',
    name: 'Llama 3.1 8B Instant',
    provider: 'groq',
    inferenceType: 'direct',
    inputPricePerMillion: 0.05,
    outputPricePerMillion: 0.08,
    description: 'Fast and compact Llama 3.1 model via Groq',
    features: ['Ultra-fast inference', 'Cost-effective', 'Open source', '560 T/sec'],
  },
  {
    id: 'groq/llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B Versatile',
    provider: 'groq',
    inferenceType: 'direct',
    inputPricePerMillion: 0.59,
    outputPricePerMillion: 0.79,
    description: 'Fast open-source model via Groq',
    features: ['Ultra-fast inference', 'Cost-effective', 'Open source'],
  },
  {
    id: 'groq/llama-guard-4-12b',
    name: 'Llama Guard 4 12B',
    provider: 'groq',
    inferenceType: 'direct',
    inputPricePerMillion: 0.20,
    outputPricePerMillion: 0.20,
    description: 'Meta\'s Llama Guard 4 for content moderation',
    features: ['Ultra-fast', '1200 T/sec', 'Content moderation', 'Safety'],
  },
  {
    id: 'groq/gpt-oss-120b',
    name: 'GPT-OSS 120B',
    provider: 'groq',
    inferenceType: 'direct',
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.60,
    description: 'OpenAI\'s flagship open-weight model via Groq',
    features: ['High capability', '500 T/sec', 'Open source', '120B parameters'],
  },
  {
    id: 'groq/gpt-oss-20b',
    name: 'GPT-OSS 20B',
    provider: 'groq',
    inferenceType: 'direct',
    inputPricePerMillion: 0.075,
    outputPricePerMillion: 0.30,
    description: 'Compact OpenAI open-weight model via Groq',
    features: ['Fastest inference', '1000 T/sec', 'Cost-effective', 'Open source'],
  },
];

/**
 * TTS Models - Text-to-Speech
 * Source: https://livekit.io/pricing/inference#tts
 */
export const TTS_MODELS: TTSModel[] = [
  // Cartesia
  {
    id: 'cartesia/sonic',
    name: 'Sonic',
    provider: 'cartesia',
    inferenceType: 'livekit',
    pricePerMillionChars: 50,
    description: 'High-quality conversational voice',
    features: ['Natural', 'Low latency', 'Expressive'],
    voices: [
      { id: 'default', name: 'Default', description: 'Natural conversational voice' },
    ],
  },
  {
    id: 'cartesia/sonic-2',
    name: 'Sonic 2',
    provider: 'cartesia',
    inferenceType: 'livekit',
    pricePerMillionChars: 50,
    description: 'Next generation Sonic voice',
    features: ['Improved quality', 'Natural', 'Fast'],
    voices: [
      { id: 'default', name: 'Default', description: 'Enhanced natural voice' },
    ],
  },
  {
    id: 'cartesia/sonic-turbo',
    name: 'Sonic Turbo',
    provider: 'cartesia',
    inferenceType: 'livekit',
    pricePerMillionChars: 50,
    description: 'Fastest Sonic variant',
    features: ['Ultra-low latency', 'Fast', 'Natural'],
    voices: [
      { id: 'default', name: 'Default', description: 'Fast natural voice' },
    ],
  },
  // ElevenLabs
  {
    id: 'elevenlabs/eleven_flash_v2',
    name: 'Eleven Flash v2',
    provider: 'elevenlabs',
    inferenceType: 'livekit',
    pricePerMillionChars: 150,
    description: 'Fast, high-quality voice synthesis',
    features: ['High quality', 'Fast', 'Expressive'],
    recommended: true,
    voices: [
      { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', description: 'Warm female voice', gender: 'female' },
      { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', description: 'Professional female voice', gender: 'female' },
      { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', description: 'Strong female voice', gender: 'female' },
      { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', description: 'Friendly male voice', gender: 'male' },
      { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', description: 'Young female voice', gender: 'female' },
      { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', description: 'Deep male voice', gender: 'male' },
    ],
  },
  {
    id: 'elevenlabs/eleven_flash_v2_5',
    name: 'Eleven Flash v2.5',
    provider: 'elevenlabs',
    inferenceType: 'livekit',
    pricePerMillionChars: 99,
    description: 'Latest flash model with improved quality',
    features: ['Latest generation', 'High quality', 'Fast'],
    voices: [
      { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', description: 'Warm female voice', gender: 'female' },
      { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', description: 'Professional female voice', gender: 'female' },
      { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', description: 'Strong female voice', gender: 'female' },
      { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', description: 'Friendly male voice', gender: 'male' },
      { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', description: 'Young female voice', gender: 'female' },
      { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', description: 'Deep male voice', gender: 'male' },
    ],
  },
  {
    id: 'elevenlabs/eleven_turbo_v2',
    name: 'Eleven Turbo v2',
    provider: 'elevenlabs',
    inferenceType: 'livekit',
    pricePerMillionChars: 150,
    description: 'Ultra-low latency voice synthesis',
    features: ['Ultra-fast', 'High quality', 'Real-time'],
    voices: [
      { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', description: 'Warm female voice', gender: 'female' },
      { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', description: 'Professional female voice', gender: 'female' },
      { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', description: 'Strong female voice', gender: 'female' },
      { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', description: 'Friendly male voice', gender: 'male' },
      { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', description: 'Young female voice', gender: 'female' },
      { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', description: 'Deep male voice', gender: 'male' },
    ],
  },
  {
    id: 'elevenlabs/eleven_turbo_v2_5',
    name: 'Eleven Turbo v2.5',
    provider: 'elevenlabs',
    inferenceType: 'livekit',
    pricePerMillionChars: 150,
    description: 'Latest turbo model with improved latency',
    features: ['Latest generation', 'Ultra-fast', 'High quality'],
    voices: [
      { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', description: 'Warm female voice', gender: 'female' },
      { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', description: 'Professional female voice', gender: 'female' },
      { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', description: 'Strong female voice', gender: 'female' },
      { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', description: 'Friendly male voice', gender: 'male' },
      { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', description: 'Young female voice', gender: 'female' },
      { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', description: 'Deep male voice', gender: 'male' },
    ],
  },
  {
    id: 'elevenlabs/eleven_multilingual_v2',
    name: 'Eleven Multilingual v2',
    provider: 'elevenlabs',
    inferenceType: 'livekit',
    pricePerMillionChars: 300,
    description: 'Multi-language support with high quality',
    features: ['Multi-language', 'High quality', 'Natural'],
    voices: [
      { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', description: 'Warm female voice', gender: 'female' },
      { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', description: 'Professional female voice', gender: 'female' },
    ],
  },
  // Inworld
  {
    id: 'inworld/inworld-tts-1',
    name: 'Inworld TTS 1',
    provider: 'inworld',
    inferenceType: 'livekit',
    pricePerMillionChars: 5,
    description: 'Affordable natural conversational voice',
    features: ['Most affordable', 'Natural', 'Conversational'],
    voices: [
      { id: 'Olivia', name: 'Olivia', description: 'Natural female voice', gender: 'female' },
      { id: 'Michael', name: 'Michael', description: 'Natural male voice', gender: 'male' },
      { id: 'Emma', name: 'Emma', description: 'Friendly female voice', gender: 'female' },
      { id: 'James', name: 'James', description: 'Professional male voice', gender: 'male' },
    ],
  },
  // Rime
  {
    id: 'rime/arcana',
    name: 'Arcana',
    provider: 'rime',
    inferenceType: 'livekit',
    pricePerMillionChars: 50,
    description: 'Rime\'s high-quality voice model',
    features: ['High quality', 'Natural', 'Expressive'],
    voices: [
      { id: 'default', name: 'Default', description: 'Natural voice' },
    ],
  },
  {
    id: 'rime/mistv2',
    name: 'Mist v2',
    provider: 'rime',
    inferenceType: 'livekit',
    pricePerMillionChars: 50,
    description: 'Enhanced Mist model',
    features: ['Enhanced quality', 'Natural', 'Fast'],
    voices: [
      { id: 'default', name: 'Default', description: 'Natural voice' },
    ],
  },
  {
    id: 'rime/mist',
    name: 'Mist',
    provider: 'rime',
    inferenceType: 'livekit',
    pricePerMillionChars: 50,
    description: 'Original Mist voice model',
    features: ['Proven quality', 'Natural', 'Reliable'],
    voices: [
      { id: 'default', name: 'Default', description: 'Natural voice' },
    ],
  },
];

// Helper functions to get models
export function getSTTModel(id: string): STTModel | undefined {
  return STT_MODELS.find(model => model.id === id);
}

export function getLLMModel(id: string): LLMModel | undefined {
  return LLM_MODELS.find(model => model.id === id);
}

export function getTTSModel(id: string): TTSModel | undefined {
  return TTS_MODELS.find(model => model.id === id);
}

export function getSTTModelsByProvider(provider: ModelProvider): STTModel[] {
  return STT_MODELS.filter(model => model.provider === provider);
}

export function getLLMModelsByProvider(provider: ModelProvider): LLMModel[] {
  return LLM_MODELS.filter(model => model.provider === provider);
}

export function getTTSModelsByProvider(provider: ModelProvider): TTSModel[] {
  return TTS_MODELS.filter(model => model.provider === provider);
}

export function getRecommendedSTTModel(): STTModel {
  return STT_MODELS.find(model => model.recommended) || STT_MODELS[0];
}

export function getRecommendedLLMModel(): LLMModel {
  return LLM_MODELS.find(model => model.recommended) || LLM_MODELS[0];
}

export function getRecommendedTTSModel(): TTSModel {
  return TTS_MODELS.find(model => model.recommended) || TTS_MODELS[0];
}

// Get voice by ID for a specific TTS model
export function getTTSVoice(modelId: string, voiceId: string): TTSVoice | undefined {
  const model = getTTSModel(modelId);
  return model?.voices?.find(voice => voice.id === voiceId);
}

// Extract provider from LiveKit model ID (e.g., "openai/gpt-4o-mini" -> "openai")
export function extractProvider(modelId: string): string {
  return modelId.split('/')[0];
}

// Extract model name from LiveKit ID (e.g., "openai/gpt-4o-mini" -> "gpt-4o-mini")
export function extractModelName(modelId: string): string {
  const parts = modelId.split('/');
  return parts.length > 1 ? parts[1] : modelId;
}

