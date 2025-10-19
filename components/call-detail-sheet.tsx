'use client'

import { useMemo, useState, useEffect } from 'react'
import { format } from 'date-fns'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import type { Call, CallStatus, CallEventType } from '@/types/call-events'
import { 
  PhoneIcon, 
  ClockIcon, 
  MessageSquareIcon, 
  CoinsIcon, 
  DollarSignIcon, 
  InfoIcon, 
  BarChart3Icon,
  ActivityIcon,
  ArrowRightIcon,
  UserIcon,
  BotIcon,
  ZapIcon,
  VolumeIcon,
  HeadphonesIcon
} from 'lucide-react'
import { calculateCallCost, formatCurrency, extractConfigDetails, REALTIME_MODEL_PRICING } from '@/lib/pricing'
import { getLLMModel, getSTTModel, getTTSModel } from '@/lib/models'

interface AgentEvent {
  id: string
  time: string
  call_id: string
  event_type: CallEventType
  data: Record<string, unknown>
}

interface CallDetailSheetProps {
  call: (Call & { agents?: { name: string }; recording_url?: string | null }) | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatTimeDelta(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`
  }
  const seconds = milliseconds / 1000
  if (seconds < 60) {
    return `${seconds.toFixed(2)}s`
  }
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = (seconds % 60).toFixed(0)
  return `${minutes}m ${remainingSeconds}s`
}

function getStatusColor(status: CallStatus): string {
  switch (status) {
    case 'completed':
      return 'bg-green-500/10 text-green-700 border-green-500/20'
    case 'connected_to_agent':
      return 'bg-blue-500/10 text-blue-700 border-blue-500/20'
    case 'transferred_to_team':
      return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20'
    case 'incoming':
      return 'bg-gray-500/10 text-gray-700 border-gray-500/20'
    case 'failed':
      return 'bg-red-500/10 text-red-700 border-red-500/20'
    default:
      return 'bg-gray-500/10 text-gray-700 border-gray-500/20'
  }
}

function getStatusLabel(status: CallStatus): string {
  switch (status) {
    case 'completed':
      return 'Completed'
    case 'connected_to_agent':
      return 'In Progress'
    case 'transferred_to_team':
      return 'Transferred'
    case 'incoming':
      return 'Incoming'
    case 'failed':
      return 'Failed'
    default:
      return status
  }
}

function getEventIcon(eventType: CallEventType) {
  switch (eventType) {
    case 'call_incoming':
      return <PhoneIcon className="size-4" />
    case 'transferred_to_team':
    case 'routed_to_agent':
      return <ArrowRightIcon className="size-4" />
    case 'team_no_answer_fallback':
      return <PhoneIcon className="size-4" />
    case 'conversation_item_added':
      return <MessageSquareIcon className="size-4" />
    case 'user_input_transcribed':
      return <UserIcon className="size-4" />
    case 'function_tools_executed':
      return <ZapIcon className="size-4" />
    case 'speech_created':
      return <VolumeIcon className="size-4" />
    case 'agent_state_changed':
    case 'user_state_changed':
      return <ActivityIcon className="size-4" />
    case 'session_complete':
      return <BotIcon className="size-4" />
    default:
      return <ActivityIcon className="size-4" />
  }
}

function getEventLabel(eventType: CallEventType): string {
  switch (eventType) {
    case 'call_incoming':
      return 'Call Received'
    case 'transferred_to_team':
      return 'Transferred to Team'
    case 'team_no_answer_fallback':
      return 'Team No Answer - Routed to Agent'
    case 'routed_to_agent':
      return 'Routed to Agent'
    case 'conversation_item_added':
      return 'Message'
    case 'user_input_transcribed':
      return 'User Speech'
    case 'function_tools_executed':
      return 'Tool Call'
    case 'agent_state_changed':
      return 'Agent State Changed'
    case 'user_state_changed':
      return 'User State Changed'
    case 'speech_created':
      return 'Speech Generated'
    case 'session_complete':
      return 'Session Complete'
    case 'transcript':
      return 'Transcript Saved'
    default:
      return eventType.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }
}

export function CallDetailSheet({ call, open, onOpenChange }: CallDetailSheetProps) {
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [loadingEvents, setLoadingEvents] = useState(false)

  // Fetch agent events when call changes
  useEffect(() => {
    if (!call?.id) {
      setEvents([])
      return
    }

    const fetchEvents = async () => {
      setLoadingEvents(true)
      try {
        const response = await fetch(`/api/calls/${call.id}/events`)
        if (response.ok) {
          const data = await response.json()
          setEvents(data.events || [])
        }
      } catch (error) {
        console.error('Failed to fetch events:', error)
        setEvents([])
      } finally {
        setLoadingEvents(false)
      }
    }

    fetchEvents()
  }, [call?.id])

  // Calculate cost for the call and extract model details
  const { callCost, modelDetails } = useMemo(() => {
    if (!call?.usage_metrics || !call?.config) {
      return { callCost: null, modelDetails: null }
    }
    const { llmModelId, sttModelId, ttsModelId } = extractConfigDetails(call.config)
    
    return {
      callCost: calculateCallCost(
        call.usage_metrics,
        llmModelId,
        sttModelId,
        ttsModelId
      ),
      modelDetails: { 
        llmModelId, 
        sttModelId, 
        ttsModelId
      }
    }
  }, [call])

  // Prepare cost breakdown data with model information
  const costBreakdown = useMemo(() => {
    if (!callCost || !modelDetails || !call?.usage_metrics) return []
    
    const items: Array<{ 
      label: string; 
      cost: number; 
      percentage: number; 
      model?: string; 
      category: string;
      calculationDetail?: string;
    }> = []
    
    const usage = call.usage_metrics
    const realtimePricing = REALTIME_MODEL_PRICING[modelDetails.llmModelId as keyof typeof REALTIME_MODEL_PRICING]
    const llmModel = getLLMModel(modelDetails.llmModelId)
    
    // Add all LLM costs
    Object.entries(callCost.breakdown.llm).forEach(([key, cost]) => {
      const label = key === 'audioInput' ? 'Audio Input' :
                    key === 'audioOutput' ? 'Audio Output' :
                    key === 'textInput' ? 'Text Input' :
                    key === 'textOutput' ? 'Text Output' :
                    key === 'textCached' ? 'Cached Text' :
                    key === 'input' ? 'Input' :
                    key === 'output' ? 'Output' :
                    key === 'cachedInput' ? 'Cached Input' : key
      
      if (cost > 0) {
        let calculationDetail = ''
        
        if (realtimePricing) {
          // Realtime model
          if (key === 'audioInput' && usage.audioInputTokens && usage.audioInputTokens > 0) {
            calculationDetail = `${usage.audioInputTokens.toLocaleString()} tokens @ $${realtimePricing.audioInputTokens} per 1M`
          } else if (key === 'audioOutput' && usage.audioOutputTokens && usage.audioOutputTokens > 0) {
            calculationDetail = `${usage.audioOutputTokens.toLocaleString()} tokens @ $${realtimePricing.audioOutputTokens} per 1M`
          } else if (key === 'textInput') {
            const nonCachedTokens = usage.llmPromptTokens - usage.llmPromptCachedTokens
            calculationDetail = `${nonCachedTokens.toLocaleString()} tokens @ $${realtimePricing.textInputTokens} per 1M`
          } else if (key === 'textCached' && usage.llmPromptCachedTokens > 0) {
            calculationDetail = `${usage.llmPromptCachedTokens.toLocaleString()} tokens @ $${realtimePricing.textCachedTokens} per 1M`
          } else if (key === 'textOutput' && usage.llmCompletionTokens > 0) {
            calculationDetail = `${usage.llmCompletionTokens.toLocaleString()} tokens @ $${realtimePricing.textOutputTokens} per 1M`
          }
        } else if (llmModel) {
          // Pipeline model
          if (key === 'input' && usage.llmPromptTokens > 0) {
            calculationDetail = `${usage.llmPromptTokens.toLocaleString()} tokens @ $${llmModel.inputPricePerMillion} per 1M`
          } else if (key === 'cachedInput' && usage.llmPromptCachedTokens > 0 && llmModel.cachedInputPricePerMillion) {
            calculationDetail = `${usage.llmPromptCachedTokens.toLocaleString()} tokens @ $${llmModel.cachedInputPricePerMillion} per 1M`
          } else if (key === 'output' && usage.llmCompletionTokens > 0) {
            calculationDetail = `${usage.llmCompletionTokens.toLocaleString()} tokens @ $${llmModel.outputPricePerMillion} per 1M`
          }
        }
        
        items.push({ 
          label, 
          cost, 
          percentage: 0, 
          model: modelDetails.llmModelId, 
          category: 'llm',
          calculationDetail 
        })
      }
    })
    
    // Add TTS cost
    if (callCost.ttsCost > 0 && usage.ttsCharactersCount > 0) {
      const ttsModel = getTTSModel(modelDetails.ttsModelId)
      const calculationDetail = ttsModel 
        ? `${usage.ttsCharactersCount.toLocaleString()} chars @ $${ttsModel.pricePerMillionChars} per 1M`
        : ''
      items.push({ 
        label: 'TTS (Voice)', 
        cost: callCost.ttsCost, 
        percentage: 0, 
        model: modelDetails.ttsModelId, 
        category: 'tts',
        calculationDetail
      })
    }
    
    // Add STT cost
    if (callCost.sttCost > 0 && usage.sttAudioDuration > 0) {
      const sttModel = getSTTModel(modelDetails.sttModelId)
      const durationMinutes = usage.sttAudioDuration / 60
      const calculationDetail = sttModel 
        ? `${durationMinutes.toFixed(2)} min @ $${sttModel.pricePerHour} per hour`
        : ''
      items.push({ 
        label: 'STT (Transcription)', 
        cost: callCost.sttCost, 
        percentage: 0, 
        model: modelDetails.sttModelId, 
        category: 'stt',
        calculationDetail
      })
    }
    
    // Calculate percentages and sort by cost descending
    items.forEach(item => {
      item.percentage = (item.cost / callCost.totalCost) * 100
    })
    
    return items.sort((a, b) => b.cost - a.cost)
  }, [callCost, modelDetails, call?.usage_metrics])

  // Calculate cost per minute
  const costPerMinute = useMemo(() => {
    if (!callCost || !call?.duration_seconds || call.duration_seconds === 0) {
      return null
    }
    const minutes = call.duration_seconds / 60
    return callCost.totalCost / minutes
  }, [callCost, call])

  if (!call) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Call Details</SheetTitle>
          <SheetDescription>
            {new Date(call.created_at).toLocaleString()}
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="overview" className="mt-6">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="overview">
              <InfoIcon className="size-4" />
              <span className="ml-1 hidden sm:inline">Overview</span>
            </TabsTrigger>
            {/* <TabsTrigger value="events">
              <ActivityIcon className="size-4" />
              <span className="ml-1 hidden sm:inline">Events</span>
            </TabsTrigger> */}
            <TabsTrigger value="cost">
              <BarChart3Icon className="size-4" />
              <span className="ml-1 hidden sm:inline">Cost</span>
            </TabsTrigger>
            <TabsTrigger value="transcript">
              <MessageSquareIcon className="size-4" />
              <span className="ml-1 hidden sm:inline">Transcript</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            {/* Total Cost Summary */}
            {callCost && (
              <Card className="border-2 border-primary/20 bg-primary/5">
                <CardContent className="pt-6 pb-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <DollarSignIcon className="size-5 text-primary" />
                          <span className="text-lg font-semibold">Total Cost</span>
                        </div>
                        <span className="text-3xl font-bold text-primary">
                          {formatCurrency(callCost.totalCost)}
                        </span>
                      </div>
                      {costPerMinute && (
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground mb-1">Per Minute</div>
                          <div className="text-base font-semibold">
                            {formatCurrency(costPerMinute)}/min
                          </div>
                        </div>
                      )}
                    </div>
                    {call.duration_seconds && call.duration_seconds > 0 && (
                      <div className="text-sm text-muted-foreground">
                        Based on {formatDuration(call.duration_seconds)} call duration
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Call Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Call Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Agent</span>
                  <span className="text-sm font-medium">
                    {call.agents?.name || 'Unknown'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Caller</span>
                  <span className="text-sm font-medium">{call.caller_phone_number}</span>
                </div>
                {call.trunk_phone_number && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Trunk Number</span>
                    <span className="text-sm font-medium">{call.trunk_phone_number}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge variant="outline" className={getStatusColor(call.status)}>
                    {getStatusLabel(call.status)}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Duration</span>
                  <span className="text-sm font-medium">
                    {formatDuration(call.duration_seconds)}
                  </span>
                </div>
                {call.twilio_call_sid && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Call SID</span>
                    <span className="text-xs font-mono text-muted-foreground">
                      {call.twilio_call_sid}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Events Timeline Tab */}
          <TabsContent value="events" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ActivityIcon className="size-4" />
                  Event Timeline
                </CardTitle>
                <CardDescription>
                  Chronological record of call events
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingEvents ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading events...
                  </div>
                ) : events.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No events recorded for this call
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                    {events.map((event, index) => {
                      const eventTime = new Date(event.time)
                      const isLastEvent = index === events.length - 1
                      
                      // Calculate time delta from previous event
                      let timeDelta: string | null = null
                      if (index > 0) {
                        const previousEventTime = new Date(events[index - 1].time)
                        const deltaMs = eventTime.getTime() - previousEventTime.getTime()
                        timeDelta = formatTimeDelta(deltaMs)
                      }
                      
                      return (
                        <div key={event.id} className="relative flex gap-3">
                          {/* Timeline line */}
                          {!isLastEvent && (
                            <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border" />
                          )}
                          
                          {/* Icon */}
                          <div className="relative flex-shrink-0 mt-1">
                            <div className="flex items-center justify-center size-6 rounded-full bg-primary/10 text-primary">
                              {getEventIcon(event.event_type)}
                            </div>
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 pb-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="font-medium text-sm">
                                  {getEventLabel(event.event_type)}
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                                  <span>{format(eventTime, 'HH:mm:ss.SSS')}</span>
                                  {timeDelta && (
                                    <>
                                      <span>•</span>
                                      <span className="text-primary font-medium">+{timeDelta}</span>
                                    </>
                                  )}
                                </div>
                                
                                {/* Event-specific details */}
                                {event.event_type === 'conversation_item_added' && (event.data as { textContent?: string; role?: string }).textContent && (
                                  <div className="mt-2 text-sm bg-muted/50 p-2 rounded text-muted-foreground">
                                    <span className="font-medium">{(event.data as { role?: string }).role}:</span> {(event.data as { textContent: string }).textContent.substring(0, 100)}{(event.data as { textContent: string }).textContent.length > 100 ? '...' : ''}
                                  </div>
                                )}
                                {event.event_type === 'user_input_transcribed' && (event.data as { transcript?: string }).transcript && (
                                  <div className="mt-2 text-sm bg-muted/50 p-2 rounded text-muted-foreground">
                                    {(event.data as { transcript: string }).transcript}
                                  </div>
                                )}
                                {event.event_type === 'function_tools_executed' && (
                                  <div className="mt-2 text-sm text-muted-foreground">
                                    {(event.data as { functionCallsCount?: number }).functionCallsCount || 0} tool{(event.data as { functionCallsCount?: number }).functionCallsCount !== 1 ? 's' : ''} called
                                  </div>
                                )}
                                {event.event_type === 'transferred_to_team' && (event.data as { transferNumber?: string }).transferNumber && (
                                  <div className="mt-2 text-sm text-muted-foreground">
                                    To: {(event.data as { transferNumber: string }).transferNumber}
                                  </div>
                                )}
                                {event.event_type === 'agent_state_changed' && (
                                  <div className="mt-2 text-sm text-muted-foreground">
                                    {(event.data as { oldState?: string; newState?: string }).oldState} → {(event.data as { oldState?: string; newState?: string }).newState}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cost & Usage Tab */}
          <TabsContent value="cost" className="space-y-4 mt-4">
            {callCost && costBreakdown.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CoinsIcon className="size-4" />
                    Cost Breakdown
                  </CardTitle>
                  <CardDescription className="flex items-center justify-between">
                    <span>Resource consumption by type</span>
                    {costPerMinute && (
                      <span className="text-xs text-muted-foreground">
                        {formatCurrency(costPerMinute)}/min
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Cost Breakdown List */}
                  <div className="space-y-3">
                    {costBreakdown.map((item, index) => (
                      <div key={index} className="space-y-1">
                        <div className="flex justify-between items-start text-sm gap-2">
                          <div className="flex-1">
                            <div className="font-medium">{item.label}</div>
                            {item.model && (
                              <div className="text-xs text-muted-foreground font-mono mt-0.5">
                                {item.model}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">
                                {item.percentage.toFixed(1)}%
                              </span>
                              <span className="font-semibold">
                                {formatCurrency(item.cost)}
                              </span>
                            </div>
                            {item.calculationDetail && (
                              <div className="text-[10px] text-muted-foreground text-right">
                                {item.calculationDetail}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${item.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Token Details */}
                  {call.usage_metrics && (
                    <div className="pt-4 border-t space-y-2">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Usage Details
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {call.usage_metrics.llmPromptTokens > 0 && (
                          <div>
                            <div className="text-muted-foreground">Prompt Tokens</div>
                            <div className="font-medium text-base">
                              {call.usage_metrics.llmPromptTokens.toLocaleString()}
                            </div>
                          </div>
                        )}
                        {call.usage_metrics.llmCompletionTokens > 0 && (
                          <div>
                            <div className="text-muted-foreground">Completion Tokens</div>
                            <div className="font-medium text-base">
                              {call.usage_metrics.llmCompletionTokens.toLocaleString()}
                            </div>
                          </div>
                        )}
                        {call.usage_metrics.audioInputTokens && call.usage_metrics.audioInputTokens > 0 && (
                          <div>
                            <div className="text-muted-foreground">Audio In</div>
                            <div className="font-medium text-base">
                              {call.usage_metrics.audioInputTokens.toLocaleString()}
                            </div>
                          </div>
                        )}
                        {call.usage_metrics.audioOutputTokens && call.usage_metrics.audioOutputTokens > 0 && (
                          <div>
                            <div className="text-muted-foreground">Audio Out</div>
                            <div className="font-medium text-base">
                              {call.usage_metrics.audioOutputTokens.toLocaleString()}
                            </div>
                          </div>
                        )}
                        {call.usage_metrics.llmPromptCachedTokens > 0 && (
                          <div>
                            <div className="text-muted-foreground">Cached</div>
                            <div className="font-medium text-base">
                              {call.usage_metrics.llmPromptCachedTokens.toLocaleString()}
                            </div>
                          </div>
                        )}
                        {call.usage_metrics.ttsCharactersCount > 0 && (
                          <div>
                            <div className="text-muted-foreground">TTS Chars</div>
                            <div className="font-medium text-base">
                              {call.usage_metrics.ttsCharactersCount.toLocaleString()}
                            </div>
                          </div>
                        )}
                        {call.usage_metrics.sttAudioDuration > 0 && (
                          <div>
                            <div className="text-muted-foreground">STT Duration</div>
                            <div className="font-medium text-base">
                              {call.usage_metrics.sttAudioDuration.toFixed(1)}s
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Transcript Tab */}
          <TabsContent value="transcript" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquareIcon className="size-4" />
                  Conversation Transcript
                </CardTitle>
                <CardDescription>
                  {call.transcript && call.transcript.length > 0 
                    ? `${call.transcript.length} messages`
                    : 'Transcript data'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Audio Player */}
                {call.recording_url && (
                  <div className="mb-4 p-3 bg-muted/50 rounded-lg border">
                    <div className="flex items-center gap-2 mb-2">
                      <HeadphonesIcon className="size-4 text-primary" />
                      <span className="text-sm font-medium">Call Recording</span>
                    </div>
                    <audio 
                      controls 
                      className="w-full"
                      preload="metadata"
                    >
                      <source src={call.recording_url} type="audio/mpeg" />
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                )}
                
                {/* Transcript Content */}
                {call.transcript && call.transcript.length > 0 ? (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                    {call.transcript.map((item, idx) => (
                      <div key={idx} className="space-y-1">
                        {item.type === 'message' && (
                          <div>
                            <div className="text-xs font-medium text-muted-foreground mb-1">
                              {item.role === 'user' ? 'User' : 'Assistant'}
                            </div>
                            <div className="text-sm bg-muted p-3 rounded-lg">
                              {item.content}
                            </div>
                          </div>
                        )}
                        {item.type === 'function_call' && (
                          <div>
                            <div className="text-xs font-medium text-blue-600 mb-1">
                              Function Call: {item.name}
                            </div>
                            <div className="text-xs bg-blue-50 p-3 rounded-lg font-mono">
                              {JSON.stringify(item.args, null, 2)}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Transcript still loading...
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}

