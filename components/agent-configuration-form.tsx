'use client'

import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { STT_MODELS, LLM_MODELS, TTS_MODELS, getTTSModel } from '@/lib/models'
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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'
import type { AgentConfiguration } from '@/types/agent-config'

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

const VOICE_OPTIONS = [
  { value: 'alloy', label: 'Alloy', description: 'Neutral, balanced voice' },
  { value: 'echo', label: 'Echo', description: 'Warm, friendly voice' },
  { value: 'shimmer', label: 'Shimmer', description: 'Bright, upbeat voice' },
  { value: 'coral', label: 'Coral', description: 'Calm, soothing voice' },
  { value: 'verse', label: 'Verse', description: 'Professional voice' },
] as const

export function AgentConfigurationForm({ agentId, slug, initialConfig, mode = 'configuration' }: AgentConfigurationFormProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [debugError, setDebugError] = useState<string | null>(null)

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
        ttsModelId: 'elevenlabs/eleven_flash_v2_5',
        ttsVoiceId: 'EXAVITQu4vr4xnSDxMaL',
        enableTranscription: true,
        recordSession: false,
        interruptible: true,
        noiseCancellation: true,
        generateFirstMessage: true,
        firstMessageType: 'direct',
        firstMessage: 'Hello! How can I help you today?',
        firstMessagePrompt: 'Greet the user warmly and ask how you can help them.',
        firstMessageAllowInterruptions: false,
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
      // Parse TTS model and voice from combined format
      ttsModelId: (() => {
        const ttsConfig = initialConfig.pipeline?.tts;
        if (!ttsConfig?.model) return 'elevenlabs/eleven_flash_v2_5';
        // Split by ':' to get model part
        return ttsConfig.model.split(':')[0] || 'elevenlabs/eleven_flash_v2_5';
      })(),
      ttsVoiceId: (() => {
        const ttsConfig = initialConfig.pipeline?.tts;
        if (!ttsConfig?.model) return 'EXAVITQu4vr4xnSDxMaL';
        // Split by ':' to get voice part
        const parts = ttsConfig.model.split(':');
        return parts.length > 1 ? parts[1] : 'EXAVITQu4vr4xnSDxMaL';
      })(),
      enableTranscription: initialConfig.settings?.enableTranscription ?? true,
      recordSession: initialConfig.settings?.recordSession ?? false,
      interruptible: initialConfig.settings?.interruptible ?? true,
      noiseCancellation: initialConfig.noiseCancellation?.enabled ?? true,
      generateFirstMessage: initialConfig.settings?.generateFirstMessage ?? true,
      firstMessageType: initialConfig.settings?.firstMessageType || 'direct',
      firstMessage: initialConfig.settings?.firstMessage || 'Hello! How can I help you today?',
      firstMessagePrompt: initialConfig.settings?.firstMessagePrompt || 'Greet the user warmly and ask how you can help them.',
      firstMessageAllowInterruptions: initialConfig.settings?.firstMessageAllowInterruptions ?? false,
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
            },
          },
        }),
        turnDetection: {
          type: 'server-vad',
          vadProvider: 'silero',
          vadOptions: {
            minSpeechDuration: 200,
            silenceTimeout: 800,
            prefixPadding: 300,
            silenceThreshold: 0.5,
          },
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
  const selectedTTSModelId = form.watch('ttsModelId')
  const firstMessageType = form.watch('firstMessageType')
  
  // Get available voices for the selected TTS model
  const availableVoices = useMemo(() => {
    if (!selectedTTSModelId) return []
    const ttsModel = getTTSModel(selectedTTSModelId)
    return ttsModel?.voices || []
  }, [selectedTTSModelId])

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
                  <FormField
                    control={form.control}
                    name="ttsModelId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>TTS Model</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select TTS model" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {TTS_MODELS.map((model) => (
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
                          Choose your text-to-speech model
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Voice selection - shown when model is selected and has voices */}
                  {selectedTTSModelId && availableVoices.length > 0 && (
                    <FormField
                      control={form.control}
                      name="ttsVoiceId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Voice</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a voice" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {availableVoices.map((voice) => (
                                <SelectItem key={voice.id} value={voice.id}>
                                  <div className="flex flex-col">
                                    <span className="font-medium">{voice.name}</span>
                                    {voice.description && (
                                      <span className="text-xs text-muted-foreground">
                                        {voice.description}
                                      </span>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Choose the voice for this model
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
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

