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
    id: 'deepgram/flux-general-en',
    name: 'Flux General (English)',
    provider: 'deepgram',
    inferenceType: 'direct',
    pricePerHour: 0.462,
    description: 'Recommended for realtime use',
    features: ['High accuracy', 'Low latency', 'English optimized', 'Supports both LiveKit and Direct'],
    recommended: true,
  },
  {
    id: 'deepgram/nova-3',
    name: 'Nova-3 (Monolingual)',
    provider: 'deepgram',
    inferenceType: 'livekit',
    pricePerHour: 0.462,
    description: 'Latest generation speech recognition for single language',
    features: ['High accuracy', 'Low latency', 'English optimized', 'Supports both LiveKit and Direct'],
    recommended: true,
  },
  // AssemblyAI
  {
    id: 'assemblyai/universal-streaming',
    name: 'Universal-Streaming',
    provider: 'assemblyai',
    inferenceType: 'livekit',
    pricePerHour: 0.150,
    description: 'Universal streaming transcription model (LiveKit Inference only)',
    features: ['Real-time streaming', 'Cost-effective', 'LiveKit Inference only'],
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
  {
    id: 'openai/gpt-4.1-nano',
    name: 'GPT-4.1 Nano',
    provider: 'azure',
    inferenceType: 'livekit',
    inputPricePerMillion: 0.10,
    outputPricePerMillion: 0.40,
    description: 'Most compact GPT-4.1 variant',
    features: ['Ultra cost-effective', 'Fast', 'Efficient'],
  },
  {
    id: 'openai/gpt-5',
    name: 'GPT-5',
    provider: 'azure',
    inferenceType: 'livekit',
    inputPricePerMillion: 1.25,
    outputPricePerMillion: 10.00,
    description: 'Next generation GPT model',
    features: ['State-of-the-art', 'High capability', 'Advanced reasoning'],
  },
  {
    id: 'openai/gpt-5-mini',
    name: 'GPT-5 Mini',
    provider: 'azure',
    inferenceType: 'livekit',
    inputPricePerMillion: 0.25,
    outputPricePerMillion: 2.00,
    description: 'Compact GPT-5 variant',
    features: ['Advanced capability', 'Cost-effective', 'Fast'],
  },
  {
    id: 'openai/gpt-5-nano',
    name: 'GPT-5 Nano',
    provider: 'azure',
    inferenceType: 'livekit',
    inputPricePerMillion: 0.05,
    outputPricePerMillion: 0.40,
    description: 'Most compact GPT-5 variant',
    features: ['Ultra cost-effective', 'Efficient', 'Fast'],
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
    id: 'groq/openai/gpt-oss-120b',
    name: 'GPT-OSS 120B',
    provider: 'groq',
    inferenceType: 'direct',
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.60,
    description: 'OpenAI\'s flagship open-weight model via Groq',
    features: ['High capability', '500 T/sec', 'Open source', '120B parameters'],
  },
  {
    id: 'groq/openai/gpt-oss-20b',
    name: 'GPT-OSS 20B',
    provider: 'groq',
    inferenceType: 'direct',
    inputPricePerMillion: 0.075,
    outputPricePerMillion: 0.30,
    description: 'Compact OpenAI open-weight model via Groq',
    features: ['Fastest inference', '1000 T/sec', 'Cost-effective', 'Open source'],
  },
  // Baseten Models
  {
    id: 'baseten/openai/gpt-oss-120b',
    name: 'GPT-OSS 120B',
    provider: 'baseten',
    inferenceType: 'direct',
    inputPricePerMillion: 0.10,
    outputPricePerMillion: 0.50,
    description: 'OpenAI\'s flagship open-weight model via Baseten',
    features: ['High capability', 'Open source', '120B parameters'],
  },
  // Cerebras Models
  {
    id: 'cerebras/openai/gpt-oss-120b',
    name: 'GPT-OSS 120B',
    provider: 'cerebras',
    inferenceType: 'direct',
    inputPricePerMillion: 0.35,
    outputPricePerMillion: 0.75,
    description: 'OpenAI\'s flagship open-weight model via Cerebras',
    features: ['High capability', 'Open source', '120B parameters'],
  },
  // Google Gemini Models
  {
    id: 'google/gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'google',
    inferenceType: 'livekit',
    inputPricePerMillion: 2.50,
    outputPricePerMillion: 15.00,
    description: 'Most capable Gemini model',
    features: ['Highest capability', 'Advanced reasoning', 'Multimodal'],
  },
  {
    id: 'google/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    inferenceType: 'livekit',
    inputPricePerMillion: 0.30,
    outputPricePerMillion: 2.50,
    description: 'Fast and efficient Gemini model',
    features: ['Fast', 'Cost-effective', 'Balanced performance'],
  },
  {
    id: 'google/gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    provider: 'google',
    inferenceType: 'livekit',
    inputPricePerMillion: 0.10,
    outputPricePerMillion: 0.40,
    description: 'Lightweight Gemini 2.5 variant',
    features: ['Ultra-fast', 'Most cost-effective', 'Efficient'],
  },
  {
    id: 'google/gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    inferenceType: 'livekit',
    inputPricePerMillion: 0.10,
    outputPricePerMillion: 0.40,
    description: 'Fast Gemini 2.0 model',
    features: ['Fast', 'Cost-effective', 'Reliable'],
  },
  {
    id: 'google/gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash Lite',
    provider: 'google',
    inferenceType: 'livekit',
    inputPricePerMillion: 0.07,
    outputPricePerMillion: 0.30,
    description: 'Most compact Gemini 2.0 variant',
    features: ['Ultra-fast', 'Lowest cost', 'Efficient'],
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

