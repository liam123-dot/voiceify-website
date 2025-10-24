'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'
import type { AgentConfiguration } from '@/types/agent-config'
import { KeywordsDialog } from './agent-configuration-form-keywords-dialog'
import { formSchema, type FormValues, type Voice } from './types'

// Import section components
import { SystemPromptCard } from './sections/SystemPromptCard'
import { FirstMessageCard } from './sections/FirstMessageCard'
import { SessionSettingsCard } from './sections/SessionSettingsCard'
import { AudioProcessingCard } from './sections/AudioProcessingCard'
import { STTSection } from './sections/STTSection'
import { LLMSection } from './sections/LLMSection'
import { TTSSection } from './sections/TTSSection'

// Import standalone components
import { TurnDetectionSettings } from './components/TurnDetectionSettings'
import { KnowledgeBaseSettings } from './components/KnowledgeBaseSettings'

interface AgentConfigurationFormProps {
  agentId: string
  slug: string
  initialConfig?: AgentConfiguration
  mode?: 'configuration' | 'models'
}

export function AgentConfigurationForm({ 
  agentId, 
  slug, 
  initialConfig, 
  mode = 'configuration' 
}: AgentConfigurationFormProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [debugError, setDebugError] = useState<string | null>(null)
  
  // Voice management state
  const [availableVoices, setAvailableVoices] = useState<Voice[]>([])
  const [isLoadingVoices, setIsLoadingVoices] = useState(false)
  const [voicesError, setVoicesError] = useState<string | null>(null)
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null)
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null)
  
  // Voice filter state
  const [selectedAccent, setSelectedAccent] = useState<string>('british')
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all')
  const [isVoiceListOpen, setIsVoiceListOpen] = useState(false)
  
  // Keywords management state
  const [keywords, setKeywords] = useState<string[]>(
    initialConfig?.pipeline?.stt?.keywords || []
  )
  const [keywordsDialogOpen, setKeywordsDialogOpen] = useState(false)

  // Extract values from initial config with proper defaults
  const getInitialValues = (): FormValues => {
    if (!initialConfig) {
      return {
        pipelineType: 'pipeline',
        instructions: 'You are a helpful AI assistant. Be friendly, professional, and concise in your responses.',
        realtimeVoice: 'alloy',
        realtimeModel: 'gpt-realtime-mini',
        sttModel: 'deepgram/nova-3',
        sttInferenceType: 'livekit',
        llmModel: 'openai/gpt-4o-mini',
        llmInferenceType: 'livekit',
        llmTemperature: 0.8,
        ttsModelId: 'elevenlabs/eleven_flash_v2_5',
        ttsVoiceId: '',
        ttsInferenceType: 'direct',
        ttsStability: 0.5,
        ttsSimilarityBoost: 0.75,
        ttsStyle: 0.0,
        ttsUseSpeakerBoost: true,
        ttsSpeed: 1.0,
        enableTranscription: true,
        recordSession: false,
        interruptible: true,
        noiseCancellation: true,
        generateFirstMessage: true,
        firstMessageType: 'direct',
        firstMessage: 'Hello! How can I help you today?',
        firstMessagePrompt: 'Greet the user warmly and ask how you can help them.',
        firstMessageAllowInterruptions: false,
        turnDetectionType: 'multilingual',
        vadMinSpeechDuration: 50,
        vadMinSilenceDuration: 550,
        vadPrefixPaddingDuration: 500,
        turnDetectorMinEndpointingDelay: 500,
        turnDetectorMaxEndpointingDelay: 6000,
        knowledgeBaseUseAsTool: false,
        knowledgeBaseMatchCount: 3,
        backgroundNoiseEnabled: false,
      }
    }

    return {
      pipelineType: 'pipeline',
      instructions: initialConfig.instructions || 'You are a helpful AI assistant. Be friendly, professional, and concise in your responses.',
      realtimeVoice: (initialConfig.realtimeModel?.voice as FormValues['realtimeVoice']) || 'alloy',
      realtimeModel: (initialConfig.realtimeModel?.model as FormValues['realtimeModel']) || 'gpt-4o-mini-realtime-preview',
      sttModel: initialConfig.pipeline?.stt?.model || 'deepgram/nova-3',
      sttInferenceType: (initialConfig.pipeline?.stt?.inferenceType as FormValues['sttInferenceType']) || 'livekit',
      llmModel: initialConfig.pipeline?.llm?.model || 'openai/gpt-4o-mini',
      llmInferenceType: (initialConfig.pipeline?.llm?.inferenceType as FormValues['llmInferenceType']) || 'livekit',
      llmTemperature: initialConfig.pipeline?.llm?.temperature ?? 0.8,
      ttsModelId: 'elevenlabs/eleven_flash_v2_5',
      ttsVoiceId: (() => {
        const ttsConfig = initialConfig.pipeline?.tts;
        if (!ttsConfig?.model) return '';
        const parts = ttsConfig.model.split(':');
        return parts.length > 1 ? parts[1] : '';
      })(),
      ttsInferenceType: 'direct',
      ttsStability: initialConfig.pipeline?.tts?.stability ?? 0.5,
      ttsSimilarityBoost: initialConfig.pipeline?.tts?.similarity_boost ?? 0.75,
      ttsStyle: initialConfig.pipeline?.tts?.style ?? 0.0,
      ttsUseSpeakerBoost: initialConfig.pipeline?.tts?.use_speaker_boost ?? true,
      ttsSpeed: initialConfig.pipeline?.tts?.speed ?? 1.0,
      enableTranscription: initialConfig.settings?.enableTranscription ?? true,
      recordSession: initialConfig.settings?.recordSession ?? false,
      interruptible: initialConfig.settings?.interruptible ?? true,
      noiseCancellation: initialConfig.noiseCancellation?.enabled ?? true,
      generateFirstMessage: initialConfig.settings?.generateFirstMessage ?? true,
      firstMessageType: initialConfig.settings?.firstMessageType || 'direct',
      firstMessage: initialConfig.settings?.firstMessage || 'Hello! How can I help you today?',
      firstMessagePrompt: initialConfig.settings?.firstMessagePrompt || 'Greet the user warmly and ask how you can help them.',
      firstMessageAllowInterruptions: initialConfig.settings?.firstMessageAllowInterruptions ?? false,
      turnDetectionType: (initialConfig.turnDetection?.type as FormValues['turnDetectionType']) || 'multilingual',
      vadMinSpeechDuration: initialConfig.turnDetection?.vadOptions?.minSpeechDuration ?? 50,
      vadMinSilenceDuration: initialConfig.turnDetection?.vadOptions?.minSilenceDuration ?? 550,
      vadPrefixPaddingDuration: initialConfig.turnDetection?.vadOptions?.prefixPaddingDuration ?? 500,
      turnDetectorMinEndpointingDelay: initialConfig.turnDetection?.turnDetectorOptions?.minEndpointingDelay ?? 500,
      turnDetectorMaxEndpointingDelay: initialConfig.turnDetection?.turnDetectorOptions?.maxEndpointingDelay ?? 6000,
      knowledgeBaseUseAsTool: initialConfig.knowledgeBase?.useAsTool ?? false,
      knowledgeBaseMatchCount: initialConfig.knowledgeBase?.matchCount ?? 3,
      backgroundNoiseEnabled: initialConfig.backgroundNoise?.enabled ?? false,
    }
  }

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: getInitialValues(),
  })

  const onSubmit = async (values: FormValues) => {
    setIsSaving(true)
    setDebugError(null)
    
    console.log('Form submitted with values:', values)
    
    try {
      // Build the complete configuration object based on pipeline type
      const configuration: AgentConfiguration = {
        pipelineType: values.pipelineType,
        instructions: values.instructions,
        ...(values.pipelineType === 'realtime' ? {
          realtimeModel: {
            provider: 'openai',
            model: values.realtimeModel || 'gpt-4o-mini-realtime-preview',
            voice: values.realtimeVoice || 'alloy',
            temperature: 0.8,
            modalities: ['audio'],
          },
        } : {
          pipeline: {
            stt: {
              provider: (values.sttModel?.split('/')[0] || 'deepgram') as 'deepgram' | 'assemblyai' | 'cartesia',
              model: values.sttModel || 'deepgram/nova-3',
              inferenceType: values.sttModel?.startsWith('assemblyai/') ? 'livekit' : (values.sttInferenceType || 'livekit'),
              language: 'en',
              keywords: keywords.length > 0 ? keywords : undefined,
            },
            llm: {
              provider: (values.llmModel?.split('/')[0] || 'openai') as 'openai' | 'azure' | 'google' | 'baseten' | 'groq' | 'cerebras',
              model: values.llmModel || 'openai/gpt-4o-mini',
              inferenceType: values.llmInferenceType || 'livekit',
              temperature: values.llmTemperature ?? 0.8,
            },
            tts: {
              model: `${values.ttsModelId || 'elevenlabs/eleven_flash_v2_5'}:${values.ttsVoiceId || 'EXAVITQu4vr4xnSDxMaL'}`,
              inferenceType: 'direct',
              stability: values.ttsStability ?? 0.5,
              similarity_boost: values.ttsSimilarityBoost ?? 0.75,
              style: values.ttsStyle ?? 0.0,
              use_speaker_boost: values.ttsUseSpeakerBoost ?? true,
              speed: values.ttsSpeed ?? 1.0,
            },
          },
        }),
        turnDetection: {
          type: values.turnDetectionType || 'multilingual',
          vadProvider: 'silero',
          vadOptions: {
            minSpeechDuration: values.vadMinSpeechDuration ?? 50,
            minSilenceDuration: values.vadMinSilenceDuration ?? 550,
            prefixPaddingDuration: values.vadPrefixPaddingDuration ?? 500,
          },
          turnDetectorOptions: values.turnDetectionType === 'multilingual' ? {
            minEndpointingDelay: values.turnDetectorMinEndpointingDelay ?? 500,
            maxEndpointingDelay: values.turnDetectorMaxEndpointingDelay ?? 6000,
          } : undefined,
        },
        noiseCancellation: {
          enabled: values.noiseCancellation,
          type: 'bvc',
        },
        knowledgeBase: {
          useAsTool: values.knowledgeBaseUseAsTool ?? false,
          matchCount: values.knowledgeBaseMatchCount ?? 3,
        },
        tools: [],
        settings: {
          enableTranscription: values.enableTranscription,
          recordSession: values.recordSession,
          interruptible: values.interruptible,
          generateFirstMessage: values.generateFirstMessage,
          firstMessageType: values.firstMessageType,
          firstMessage: values.firstMessage,
          firstMessagePrompt: values.firstMessagePrompt,
          firstMessageAllowInterruptions: values.firstMessageAllowInterruptions,
        },
        backgroundNoise: {
          enabled: values.backgroundNoiseEnabled ?? false,
        },
      }

      console.log('Sending configuration:', configuration)

      const response = await fetch(`/api/${slug}/agents/${agentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ configuration }),
      })

      console.log('Response status:', response.status)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('API error:', errorData)
        throw new Error(errorData.error || 'Failed to update agent configuration')
      }

      const responseData = await response.json()
      console.log('Success response:', responseData)

      toast.success('Configuration saved successfully', {
        description: 'Your agent has been updated and is ready to use.'
      })
    } catch (error) {
      console.error('Error saving configuration:', error)
      const message = error instanceof Error ? error.message : 'Failed to save configuration'
      setDebugError(message)
      toast.error('Failed to save configuration', {
        description: message
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Watch form values
  const sttModel = form.watch('sttModel')
  const llmTemperature = form.watch('llmTemperature')
  const ttsVoiceId = form.watch('ttsVoiceId')
  const ttsStability = form.watch('ttsStability')
  const ttsSimilarityBoost = form.watch('ttsSimilarityBoost')
  const ttsStyle = form.watch('ttsStyle')
  const ttsSpeed = form.watch('ttsSpeed')
  const turnDetectionType = form.watch('turnDetectionType')
  const vadMinSpeechDuration = form.watch('vadMinSpeechDuration')
  const vadMinSilenceDuration = form.watch('vadMinSilenceDuration')
  const vadPrefixPaddingDuration = form.watch('vadPrefixPaddingDuration')
  const turnDetectorMinEndpointingDelay = form.watch('turnDetectorMinEndpointingDelay')
  const turnDetectorMaxEndpointingDelay = form.watch('turnDetectorMaxEndpointingDelay')
  const knowledgeBaseMatchCount = form.watch('knowledgeBaseMatchCount')
  const generateFirstMessage = form.watch('generateFirstMessage')
  const firstMessageType = form.watch('firstMessageType')

  // Fetch all available voices from ElevenLabs
  const fetchVoices = async () => {
    setIsLoadingVoices(true)
    setVoicesError(null)

    try {
      const response = await fetch('/api/elevenlabs/voices')
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch voices' }))
        throw new Error(errorData.error || 'Failed to load voices')
      }

      const data = await response.json()
      setAvailableVoices(data.voices || [])
      setVoicesError(null)
    } catch (error) {
      console.error('Error fetching voices:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch voices'
      setVoicesError(errorMessage)
      toast.error('Failed to load voices', {
        description: errorMessage
      })
    } finally {
      setIsLoadingVoices(false)
    }
  }

  // Stop currently playing audio
  const stopAudio = () => {
    if (currentAudio) {
      currentAudio.pause()
      currentAudio.currentTime = 0
      setCurrentAudio(null)
      setPlayingVoiceId(null)
    }
  }

  // Play voice preview
  const playVoicePreview = (voiceId: string, previewUrl: string | null) => {
    if (playingVoiceId === voiceId && currentAudio) {
      stopAudio()
      return
    }

    stopAudio()

    if (!previewUrl) {
      toast.error('No preview available for this voice')
      return
    }

    setPlayingVoiceId(voiceId)
    const audio = new Audio(previewUrl)
    setCurrentAudio(audio)
    
    audio.onended = () => {
      setPlayingVoiceId(null)
      setCurrentAudio(null)
    }
    
    audio.onerror = () => {
      setPlayingVoiceId(null)
      setCurrentAudio(null)
      toast.error('Failed to play voice preview')
    }
    
    audio.play().catch(error => {
      console.error('Error playing audio:', error)
      setPlayingVoiceId(null)
      setCurrentAudio(null)
      toast.error('Failed to play voice preview')
    })
  }

  // Load voices on mount
  useEffect(() => {
    fetchVoices()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (currentAudio) {
        currentAudio.pause()
        currentAudio.currentTime = 0
      }
    }
  }, [currentAudio])

  return (
    <>
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Debug Error Display */}
        {debugError && (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800 border border-red-200">
            <strong>Error:</strong> {debugError}
          </div>
        )}
        
        {/* Form Errors Display */}
        {Object.keys(form.formState.errors).length > 0 && (
          <div className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800 border border-yellow-200">
            <strong>Form validation errors:</strong>
            <ul className="list-disc list-inside mt-2">
              {Object.entries(form.formState.errors).map(([key, error]) => (
                <li key={key}>
                  {key}: {error?.message as string}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Configuration Mode - Prompts and Settings */}
        {mode === 'configuration' && (
          <>
            <SystemPromptCard control={form.control} />
            
            <FirstMessageCard 
              control={form.control}
              generateFirstMessage={generateFirstMessage}
              firstMessageType={firstMessageType}
            />

            <SessionSettingsCard control={form.control} />

            <AudioProcessingCard control={form.control} />
          </>
        )}

        {/* Models Mode - Pipeline Type and Model Configurations */}
        {mode === 'models' && (
          <>
            {/* Pipeline Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>Pipeline Components</CardTitle>
                <CardDescription>
                  Configure each component of the pipeline (STT, LLM, TTS)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <STTSection
                  control={form.control}
                  sttModel={sttModel}
                  keywords={keywords}
                  onManageKeywords={() => setKeywordsDialogOpen(true)}
                />

                <Separator />

                <LLMSection 
                  control={form.control}
                  llmTemperature={llmTemperature}
                />

                <Separator />

                <TTSSection
                  control={form.control}
                  ttsVoiceId={ttsVoiceId}
                  ttsStability={ttsStability}
                  ttsSimilarityBoost={ttsSimilarityBoost}
                  ttsStyle={ttsStyle}
                  ttsSpeed={ttsSpeed}
                  availableVoices={availableVoices}
                  isLoadingVoices={isLoadingVoices}
                  voicesError={voicesError}
                  playingVoiceId={playingVoiceId}
                  selectedAccent={selectedAccent}
                  selectedLanguage={selectedLanguage}
                  isVoiceListOpen={isVoiceListOpen}
                  onFetchVoices={fetchVoices}
                  onPlayVoicePreview={playVoicePreview}
                  onAccentChange={setSelectedAccent}
                  onLanguageChange={setSelectedLanguage}
                  onVoiceListOpenChange={setIsVoiceListOpen}
                />
              </CardContent>
            </Card>

            <TurnDetectionSettings
              control={form.control}
              turnDetectionType={turnDetectionType}
              vadMinSpeechDuration={vadMinSpeechDuration}
              vadMinSilenceDuration={vadMinSilenceDuration}
              vadPrefixPaddingDuration={vadPrefixPaddingDuration}
              turnDetectorMinEndpointingDelay={turnDetectorMinEndpointingDelay}
              turnDetectorMaxEndpointingDelay={turnDetectorMaxEndpointingDelay}
            />

            <KnowledgeBaseSettings
              control={form.control}
              knowledgeBaseMatchCount={knowledgeBaseMatchCount}
            />
          </>
        )}

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => form.reset()}
            disabled={isSaving}
          >
            Reset
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Configuration
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>

    {/* Keywords Dialog */}
    <KeywordsDialog
      open={keywordsDialogOpen}
      onOpenChange={setKeywordsDialogOpen}
      agentId={agentId}
      organizationId={slug}
      currentKeywords={keywords}
      onKeywordsUpdated={setKeywords}
    />
  </>
  )
}
