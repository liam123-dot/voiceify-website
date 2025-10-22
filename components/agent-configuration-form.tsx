'use client'

import { useState, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { STT_MODELS, LLM_MODELS } from '@/lib/models'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { toast } from 'sonner'
import { Loader2, Save, Play, Pause, ChevronDown } from 'lucide-react'
import type { AgentConfiguration } from '@/types/agent-config'

// Voice interface
interface Voice {
  voiceId: string
  name: string
  description: string | null
  category: string | null
  labels: Record<string, string>
  previewUrl: string | null
}

const formSchema = z.object({
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
  llmModel: z.string().optional(), // LiveKit format: "openai/gpt-4o-mini"
  llmTemperature: z.number().min(0).max(1).optional(),
  ttsModelId: z.string().optional(), // LiveKit format: "elevenlabs/eleven_flash_v2_5"
  ttsVoiceId: z.string().optional(), // Voice ID: "EXAVITQu4vr4xnSDxMaL"
  
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

type FormValues = z.infer<typeof formSchema>

interface AgentConfigurationFormProps {
  agentId: string
  slug: string
  initialConfig?: AgentConfiguration
  mode?: 'configuration' | 'models'
}

export function AgentConfigurationForm({ agentId, slug, initialConfig, mode = 'configuration' }: AgentConfigurationFormProps) {
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

  // Extract values from initial config with proper defaults
  const getInitialValues = (): FormValues => {
    if (!initialConfig) {
      return {
        pipelineType: 'pipeline',
        instructions: 'You are a helpful AI assistant. Be friendly, professional, and concise in your responses.',
        realtimeVoice: 'alloy',
        realtimeModel: 'gpt-realtime-mini',
        sttModel: 'deepgram/nova-2-phonecall',
        llmModel: 'openai/gpt-4o-mini',
        llmTemperature: 0.8,
        ttsModelId: 'elevenlabs/eleven_flash_v2_5', // Fixed to Eleven Flash v2.5
        ttsVoiceId: '',
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
        // Turn detection and VAD defaults
        turnDetectionType: 'multilingual',
        vadMinSpeechDuration: 50,
        vadMinSilenceDuration: 550,
        vadPrefixPaddingDuration: 500,
        turnDetectorMinEndpointingDelay: 500,
        turnDetectorMaxEndpointingDelay: 6000,
      }
    }

    return {
      pipelineType: 'pipeline',
      instructions: initialConfig.instructions || 'You are a helpful AI assistant. Be friendly, professional, and concise in your responses.',
      realtimeVoice: (initialConfig.realtimeModel?.voice as FormValues['realtimeVoice']) || 'alloy',
      realtimeModel: (initialConfig.realtimeModel?.model as FormValues['realtimeModel']) || 'gpt-4o-mini-realtime-preview',
      sttModel: initialConfig.pipeline?.stt?.model || 'deepgram/nova-2-phonecall',
      llmModel: initialConfig.pipeline?.llm?.model || 'openai/gpt-4o-mini',
      llmTemperature: initialConfig.pipeline?.llm?.temperature ?? 0.8,
      // Fixed to Eleven Flash v2.5
      ttsModelId: 'elevenlabs/eleven_flash_v2_5',
      // Extract voice ID from combined format
      ttsVoiceId: (() => {
        const ttsConfig = initialConfig.pipeline?.tts;
        if (!ttsConfig?.model) return '';
        // Split by ':' to get voice part
        const parts = ttsConfig.model.split(':');
        return parts.length > 1 ? parts[1] : '';
      })(),
      // ElevenLabs TTS settings
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
      // Turn detection and VAD from initialConfig
      turnDetectionType: (initialConfig.turnDetection?.type as FormValues['turnDetectionType']) || 'multilingual',
      vadMinSpeechDuration: initialConfig.turnDetection?.vadOptions?.minSpeechDuration ?? 50,
      vadMinSilenceDuration: initialConfig.turnDetection?.vadOptions?.minSilenceDuration ?? 550,
      vadPrefixPaddingDuration: initialConfig.turnDetection?.vadOptions?.prefixPaddingDuration ?? 500,
      turnDetectorMinEndpointingDelay: initialConfig.turnDetection?.turnDetectorOptions?.minEndpointingDelay ?? 500,
      turnDetectorMaxEndpointingDelay: initialConfig.turnDetection?.turnDetectorOptions?.maxEndpointingDelay ?? 6000,
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
              model: values.sttModel || 'deepgram/nova-2-phonecall',
              language: 'en',
            },
            llm: {
              provider: (values.llmModel?.split('/')[0] || 'openai') as 'openai' | 'azure' | 'google' | 'baseten' | 'groq' | 'cerebras',
              model: values.llmModel || 'openai/gpt-4o-mini',
              temperature: values.llmTemperature ?? 0.8,
            },
            tts: {
              // Combine model and voice into LiveKit format: "provider/model:voiceId"
              model: `${values.ttsModelId || 'elevenlabs/eleven_flash_v2_5'}:${values.ttsVoiceId || 'EXAVITQu4vr4xnSDxMaL'}`,
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

      // Optionally refresh the page to show updated data
      // router.refresh()
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
    // If clicking the same voice that's playing, stop it
    if (playingVoiceId === voiceId && currentAudio) {
      stopAudio()
      return
    }

    // Stop any currently playing audio
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

  // Extract unique accents and languages from voices
  const { accents, languages } = useMemo(() => {
    const accentSet = new Set<string>()
    const languageSet = new Set<string>()
    
    availableVoices.forEach(voice => {
      if (voice.labels) {
        if (voice.labels.accent) {
          accentSet.add(voice.labels.accent)
        }
        if (voice.labels.language) {
          languageSet.add(voice.labels.language)
        }
      }
    })
    
    return {
      accents: Array.from(accentSet).sort(),
      languages: Array.from(languageSet).sort()
    }
  }, [availableVoices])

  // Filter voices based on selected accent and language
  const filteredVoices = useMemo(() => {
    return availableVoices.filter(voice => {
      const matchesAccent = selectedAccent === 'all' || 
        (voice.labels?.accent === selectedAccent)
      
      const matchesLanguage = selectedLanguage === 'all' || 
        (voice.labels?.language === selectedLanguage)
      
      return matchesAccent && matchesLanguage
    })
  }, [availableVoices, selectedAccent, selectedLanguage])

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
            {/* System Prompt */}
            <Card>
              <CardHeader>
                <CardTitle>System Prompt</CardTitle>
                <CardDescription>
                  Define your agent&apos;s personality, role, and behavior
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="instructions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Instructions</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="You are a helpful AI assistant..."
                          className="h-[200px] resize-y"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Core system prompt that defines your agent&apos;s role and behavior. Be specific about the agent&apos;s purpose, tone, and how it should interact with users.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* First Message Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>First Message</CardTitle>
                <CardDescription>
                  Configure how your agent greets users when they connect
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="generateFirstMessage"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Enable First Message</FormLabel>
                        <FormDescription>
                          Agent greets the user when they connect
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {form.watch('generateFirstMessage') && (
                  <>
                    <FormField
                      control={form.control}
                      name="firstMessageType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Message Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select message type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="direct">
                                <div className="flex flex-col">
                                  <span className="font-medium">Direct Message</span>
                                  <span className="text-xs text-muted-foreground">
                                    Say a specific message exactly as written
                                  </span>
                                </div>
                              </SelectItem>
                              <SelectItem value="generated">
                                <div className="flex flex-col">
                                  <span className="font-medium">AI-Generated Message</span>
                                  <span className="text-xs text-muted-foreground">
                                    Let AI generate the greeting based on a prompt
                                  </span>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Choose whether to use a predefined message or let AI generate one
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {form.watch('firstMessageType') === 'direct' ? (
                      <FormField
                        control={form.control}
                        name="firstMessage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Message Text</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Hello! How can I help you today?"
                                className="min-h-[100px] resize-y"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              The exact message the agent will say when the call starts
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : (
                      <FormField
                        control={form.control}
                        name="firstMessagePrompt"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Message Prompt</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Greet the user warmly and ask how you can help them."
                                className="min-h-[100px] resize-y"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Instructions for generating the greeting message. Context about the caller will be automatically included.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <FormField
                      control={form.control}
                      name="firstMessageAllowInterruptions"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Allow Interruptions</FormLabel>
                            <FormDescription>
                              Whether the user can interrupt the first message
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </>
                )}
              </CardContent>
            </Card>

            {/* Session Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Session Settings</CardTitle>
                <CardDescription>
                  Control how your agent handles conversations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="enableTranscription"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Enable Transcription</FormLabel>
                        <FormDescription>
                          Save text transcripts of all conversations
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="recordSession"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Record Session</FormLabel>
                        <FormDescription>
                          Save audio recordings of all conversations
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Audio Processing */}
            <Card>
              <CardHeader>
                <CardTitle>Audio Processing</CardTitle>
                <CardDescription>
                  Configure audio quality and processing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="noiseCancellation"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Noise Cancellation</FormLabel>
                        <FormDescription>
                          Remove background noise from user audio
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
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
                {/* STT Configuration */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Speech-to-Text</h4>
                  <FormField
                    control={form.control}
                    name="sttModel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>STT Model</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select STT model" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {STT_MODELS.map((model) => (
                              <SelectItem key={model.id} value={model.id}>
                                <div className="flex flex-col">
                                  <span className="font-medium">{model.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {model.description} {model.recommended && '(Recommended)'}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Choose your speech recognition model
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                {/* LLM Configuration */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Language Model</h4>
                  <FormField
                    control={form.control}
                    name="llmModel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>LLM Model</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select LLM model" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {LLM_MODELS.map((model) => (
                              <SelectItem key={model.id} value={model.id}>
                                <div className="flex flex-col">
                                  <span className="font-medium">{model.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {model.description} {model.recommended && '(Recommended)'}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="llmTemperature"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>Temperature</FormLabel>
                          <span className="text-sm font-mono text-muted-foreground">
                            {llmTemperature?.toFixed(1) ?? '0.8'}
                          </span>
                        </div>
                        <FormControl>
                          <Slider
                            min={0}
                            max={1}
                            step={0.1}
                            value={[field.value ?? 0.8]}
                            onValueChange={(value) => field.onChange(value[0])}
                            className="py-4"
                          />
                        </FormControl>
                        <FormDescription>
                          Higher values make output more creative
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                {/* TTS Configuration */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Text-to-Speech</h4>
                  
                  {/* Fixed TTS Model display */}
                  <div className="rounded-lg border p-4 bg-muted/50">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">TTS Model</p>
                      <p className="text-sm text-muted-foreground">Eleven Flash v2.5</p>
                      <p className="text-xs text-muted-foreground">
                        Latest generation flash model with improved quality
                      </p>
                    </div>
                  </div>

                  {/* Voice Selection */}
                  <FormField
                    control={form.control}
                    name="ttsVoiceId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Voice</FormLabel>
                        <FormDescription>
                          Select a voice from your ElevenLabs account
                        </FormDescription>

                        {/* Display selected voice */}
                        {field.value && !isVoiceListOpen && (
                          <div className="rounded-lg border p-4 bg-muted/50">
                            <div className="flex items-center justify-between">
                              <div className="space-y-1">
                                <p className="text-sm font-medium">
                                  {availableVoices.find(v => v.voiceId === field.value)?.name || 'Selected Voice'}
                                </p>
                                {availableVoices.find(v => v.voiceId === field.value)?.description && (
                                  <p className="text-xs text-muted-foreground">
                                    {availableVoices.find(v => v.voiceId === field.value)?.description}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {availableVoices.find(v => v.voiceId === field.value)?.previewUrl && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.preventDefault()
                                      const voice = availableVoices.find(v => v.voiceId === field.value)
                                      if (voice) playVoicePreview(voice.voiceId, voice.previewUrl)
                                    }}
                                    title={playingVoiceId === field.value ? 'Stop preview' : 'Play preview'}
                                  >
                                    {playingVoiceId === field.value ? (
                                      <Pause className="h-4 w-4" />
                                    ) : (
                                      <Play className="h-4 w-4" />
                                    )}
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setIsVoiceListOpen(true)}
                                >
                                  Change Voice
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Show voice browser when changing or no voice selected */}
                        {(isVoiceListOpen || !field.value) && (
                        <>
                        {isLoadingVoices ? (
                          <div className="flex items-center justify-center p-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            <span className="ml-2 text-sm text-muted-foreground">Loading voices...</span>
                          </div>
                        ) : voicesError ? (
                          <div className="rounded-lg border bg-red-50 dark:bg-red-950/20 p-4">
                            <p className="text-sm text-red-800 dark:text-red-200">
                              {voicesError}
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={fetchVoices}
                              className="mt-2"
                            >
                              Retry
                            </Button>
                          </div>
                        ) : availableVoices.length === 0 ? (
                          <div className="rounded-lg border bg-yellow-50 dark:bg-yellow-950/20 p-4">
                            <p className="text-sm text-yellow-800 dark:text-yellow-200">
                              No voices found in your ElevenLabs account.
                            </p>
                          </div>
                        ) : (
                          <>
                            {/* Filter Controls */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                              <div className="space-y-2">
                                <label className="text-sm font-medium">Filter by Accent</label>
                                <Select value={selectedAccent} onValueChange={setSelectedAccent}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="British" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">All accents</SelectItem>
                                    {accents.map((accent) => (
                                      <SelectItem key={accent} value={accent}>
                                        {accent.charAt(0).toUpperCase() + accent.slice(1)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              <div className="space-y-2">
                                <label className="text-sm font-medium">Filter by Language</label>
                                <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="All languages" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">All languages</SelectItem>
                                    {languages.map((language) => (
                                      <SelectItem key={language} value={language}>
                                        {language.charAt(0).toUpperCase() + language.slice(1)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {/* Results count */}
                            <div className="text-sm text-muted-foreground mb-3">
                              Showing {filteredVoices.length} of {availableVoices.length} voices
                            </div>

                            {filteredVoices.length === 0 ? (
                              <div className="rounded-lg border bg-yellow-50 dark:bg-yellow-950/20 p-4">
                                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                  No voices match the selected filters. Try adjusting your filters.
                                </p>
                              </div>
                            ) : (
                              <FormControl>
                                <RadioGroup
                                  onValueChange={field.onChange}
                                  value={field.value}
                                  className="space-y-2 max-h-[600px] overflow-y-auto pr-2"
                                >
                                  {filteredVoices.map((voice) => (
                                <div
                                  key={voice.voiceId}
                                  className="flex items-center space-x-3 rounded-lg border p-4 hover:bg-accent"
                                >
                                  <RadioGroupItem value={voice.voiceId} id={voice.voiceId} />
                                  <label
                                    htmlFor={voice.voiceId}
                                    className="flex-1 cursor-pointer"
                                  >
                                    <div className="space-y-1">
                                      <p className="text-sm font-medium leading-none">
                                        {voice.name}
                                      </p>
                                      {voice.description && (
                                        <p className="text-xs text-muted-foreground">
                                          {voice.description}
                                        </p>
                                      )}
                                      <div className="flex flex-wrap gap-1 mt-2">
                                        {voice.category && (
                                          <span className="text-xs px-2 py-0.5 rounded-md bg-secondary">
                                            {voice.category}
                                          </span>
                                        )}
                                        {Object.entries(voice.labels).slice(0, 3).map(([key, value]) => (
                                          <span
                                            key={key}
                                            className="text-xs px-2 py-0.5 rounded-md bg-secondary"
                                          >
                                            {key}: {value}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </label>
                                  {voice.previewUrl && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={(e) => {
                                        e.preventDefault()
                                        playVoicePreview(voice.voiceId, voice.previewUrl)
                                      }}
                                      title={playingVoiceId === voice.voiceId ? 'Stop preview' : 'Play preview'}
                                    >
                                      {playingVoiceId === voice.voiceId ? (
                                        <Pause className="h-4 w-4" />
                                      ) : (
                                        <Play className="h-4 w-4" />
                                      )}
                                    </Button>
                                  )}
                                </div>
                              ))}
                                </RadioGroup>
                              </FormControl>
                            )}
                          </>
                        )}
                            
                        {/* Close button when voice list is open and a voice is selected */}
                        {field.value && (
                              <div className="mt-4 flex justify-end">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => setIsVoiceListOpen(false)}
                                >
                                  Done
                                </Button>
                              </div>
                            )}
                          </>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Separator />

                  {/* Advanced TTS Settings */}
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center justify-between w-full hover:underline">
                      <h4 className="text-sm font-medium">Advanced Voice Settings</h4>
                      <ChevronDown className="h-4 w-4" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-4 pt-4">
                      {/* Stability Slider */}
                      <FormField
                        control={form.control}
                        name="ttsStability"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between">
                              <FormLabel>Stability</FormLabel>
                              <span className="text-sm font-mono text-muted-foreground">
                                {ttsStability?.toFixed(2) ?? '0.50'}
                              </span>
                            </div>
                            <FormControl>
                              <Slider
                                min={0.25}
                                max={1}
                                step={0.05}
                                value={[field.value ?? 0.5]}
                                onValueChange={(value) => field.onChange(value[0])}
                                className="py-4"
                              />
                            </FormControl>
                            <FormDescription>
                              Controls consistency. 0.25 (most variable/emotional) to 1.0 (most stable/monotone)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Similarity Boost Slider */}
                      <FormField
                        control={form.control}
                        name="ttsSimilarityBoost"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between">
                              <FormLabel>Similarity Boost</FormLabel>
                              <span className="text-sm font-mono text-muted-foreground">
                                {ttsSimilarityBoost?.toFixed(2) ?? '0.75'}
                              </span>
                            </div>
                            <FormControl>
                              <Slider
                                min={0}
                                max={1}
                                step={0.05}
                                value={[field.value ?? 0.75]}
                                onValueChange={(value) => field.onChange(value[0])}
                                className="py-4"
                              />
                            </FormControl>
                            <FormDescription>
                              How closely to match the original voice. Higher = closer match
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Style Slider */}
                      <FormField
                        control={form.control}
                        name="ttsStyle"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between">
                              <FormLabel>Style</FormLabel>
                              <span className="text-sm font-mono text-muted-foreground">
                                {ttsStyle?.toFixed(2) ?? '0.00'}
                              </span>
                            </div>
                            <FormControl>
                              <Slider
                                min={0}
                                max={0.75}
                                step={0.05}
                                value={[field.value ?? 0.0]}
                                onValueChange={(value) => field.onChange(value[0])}
                                className="py-4"
                              />
                            </FormControl>
                            <FormDescription>
                              Expressiveness level. 0 (neutral) to 0.75 (highly expressive, may reduce stability)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Speaker Boost Toggle */}
                      <FormField
                        control={form.control}
                        name="ttsUseSpeakerBoost"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Speaker Boost</FormLabel>
                              <FormDescription>
                                Enhances similarity to original speaker (may increase latency)
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value ?? true}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {/* Speed Slider */}
                      <FormField
                        control={form.control}
                        name="ttsSpeed"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between">
                              <FormLabel>Speed</FormLabel>
                              <span className="text-sm font-mono text-muted-foreground">
                                {ttsSpeed?.toFixed(2) ?? '1.00'}x
                              </span>
                            </div>
                            <FormControl>
                              <Slider
                                min={0.7}
                                max={1.2}
                                step={0.05}
                                value={[field.value ?? 1.0]}
                                onValueChange={(value) => field.onChange(value[0])}
                                className="py-4"
                              />
                            </FormControl>
                            <FormDescription>
                              Playback speed. 0.7x (slower) to 1.2x (faster), 1.0x = normal
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </CardContent>
            </Card>

            {/* Turn Detection and VAD Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>Turn Detection & VAD</CardTitle>
                <CardDescription>
                  Configure how the agent detects when a user has finished speaking
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Turn Detection Type */}
                <FormField
                  control={form.control}
                  name="turnDetectionType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Turn Detection Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select turn detection type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="multilingual">
                            <div className="flex flex-col">
                              <span className="font-medium">Multilingual (EOU + VAD)</span>
                              <span className="text-xs text-muted-foreground">
                                Uses semantic understanding and VAD for best turn detection
                              </span>
                            </div>
                          </SelectItem>
                          <SelectItem value="server-vad">
                            <div className="flex flex-col">
                              <span className="font-medium">Server VAD Only</span>
                              <span className="text-xs text-muted-foreground">
                                Basic voice activity detection without semantic analysis
                              </span>
                            </div>
                          </SelectItem>
                          <SelectItem value="disabled">
                            <div className="flex flex-col">
                              <span className="font-medium">Disabled</span>
                              <span className="text-xs text-muted-foreground">
                                No automatic turn detection
                              </span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Multilingual mode reduces interruptions by 85% compared to VAD-only
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                {/* VAD Settings */}
                {turnDetectionType !== 'disabled' && (
                  <>
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium">Voice Activity Detection (VAD) Settings</h4>
                      
                      {/* Min Speech Duration */}
                      <FormField
                        control={form.control}
                        name="vadMinSpeechDuration"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between">
                              <FormLabel>Minimum Speech Duration</FormLabel>
                              <span className="text-sm font-mono text-muted-foreground">
                                {vadMinSpeechDuration ?? 50}ms
                              </span>
                            </div>
                            <FormControl>
                              <Slider
                                min={10}
                                max={500}
                                step={10}
                                value={[field.value ?? 50]}
                                onValueChange={(value) => field.onChange(value[0])}
                                className="py-4"
                              />
                            </FormControl>
                            <FormDescription>
                              Minimum duration of speech required to start a new speech chunk
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Min Silence Duration */}
                      <FormField
                        control={form.control}
                        name="vadMinSilenceDuration"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between">
                              <FormLabel>Minimum Silence Duration</FormLabel>
                              <span className="text-sm font-mono text-muted-foreground">
                                {vadMinSilenceDuration ?? 550}ms
                              </span>
                            </div>
                            <FormControl>
                              <Slider
                                min={100}
                                max={2000}
                                step={50}
                                value={[field.value ?? 550]}
                                onValueChange={(value) => field.onChange(value[0])}
                                className="py-4"
                              />
                            </FormControl>
                            <FormDescription>
                              Duration of silence to wait after speech ends to determine if the user has finished speaking
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Prefix Padding Duration */}
                      <FormField
                        control={form.control}
                        name="vadPrefixPaddingDuration"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between">
                              <FormLabel>Prefix Padding Duration</FormLabel>
                              <span className="text-sm font-mono text-muted-foreground">
                                {vadPrefixPaddingDuration ?? 500}ms
                              </span>
                            </div>
                            <FormControl>
                              <Slider
                                min={0}
                                max={1000}
                                step={50}
                                value={[field.value ?? 500]}
                                onValueChange={(value) => field.onChange(value[0])}
                                className="py-4"
                              />
                            </FormControl>
                            <FormDescription>
                              Duration of padding to add to the beginning of each speech chunk
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* EOU Settings (only for multilingual) */}
                    {turnDetectionType === 'multilingual' && (
                      <>
                        <Separator />
                        <div className="space-y-4">
                          <h4 className="text-sm font-medium">End-of-Utterance (EOU) Settings</h4>
                          
                          {/* Min Endpointing Delay */}
                          <FormField
                            control={form.control}
                            name="turnDetectorMinEndpointingDelay"
                            render={({ field }) => (
                              <FormItem>
                                <div className="flex items-center justify-between">
                                  <FormLabel>Minimum Endpointing Delay</FormLabel>
                                  <span className="text-sm font-mono text-muted-foreground">
                                    {turnDetectorMinEndpointingDelay ?? 500}ms
                                  </span>
                                </div>
                                <FormControl>
                                  <Slider
                                    min={0}
                                    max={2000}
                                    step={50}
                                    value={[field.value ?? 500]}
                                    onValueChange={(value) => field.onChange(value[0])}
                                    className="py-4"
                                  />
                                </FormControl>
                                <FormDescription>
                                  The number of seconds to wait before considering the turn complete (lower = faster response)
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* Max Endpointing Delay */}
                          <FormField
                            control={form.control}
                            name="turnDetectorMaxEndpointingDelay"
                            render={({ field }) => (
                              <FormItem>
                                <div className="flex items-center justify-between">
                                  <FormLabel>Maximum Endpointing Delay</FormLabel>
                                  <span className="text-sm font-mono text-muted-foreground">
                                    {turnDetectorMaxEndpointingDelay ?? 6000}ms
                                  </span>
                                </div>
                                <FormControl>
                                  <Slider
                                    min={1000}
                                    max={10000}
                                    step={500}
                                    value={[field.value ?? 6000]}
                                    onValueChange={(value) => field.onChange(value[0])}
                                    className="py-4"
                                  />
                                </FormControl>
                                <FormDescription>
                                  Maximum time to wait for the user to speak when the model indicates they may continue
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
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
  )
}

