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
  MessageSquareIcon,
  CoinsIcon,
  DollarSignIcon,
  InfoIcon,
  BarChart3Icon,
  ActivityIcon,
  ArrowRightIcon,
  UserIcon,
  ZapIcon,
  VolumeIcon,
  HeadphonesIcon,
  BookOpenIcon,
  FileTextIcon,
  CheckCircleIcon
} from 'lucide-react'
import { calculateCallCost, formatCurrency, extractConfigDetails, REALTIME_MODEL_PRICING } from '@/lib/pricing'
import { getLLMModel, getSTTModel, getTTSModel } from '@/lib/models'
import { AudioEventTimeline } from '@/components/audio-event-timeline'

interface AgentEvent {
  id: string
  time: string
  call_id: string
  event_type: CallEventType
  data: Record<string, unknown>
}

interface CallDetailSheetProps {
  call: (Call & { agents?: { name: string }; recording_url?: string | null }) | null
  slug: string
  open: boolean
  onOpenChange: (open: boolean) => void
  showEvents?: boolean
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
      return <CheckCircleIcon className="size-4" />
    case 'transcript':
      return <FileTextIcon className="size-4" />
    case 'knowledge_retrieved':
      return <BookOpenIcon className="size-4" />
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
    case 'knowledge_retrieved':
      return 'Knowledge Retrieved'
    case 'transfer_initiated':
      return 'Transfer Initiated'
    case 'transfer_no_answer':
      return 'Transfer No Answer'
    case 'transfer_failed':
      return 'Transfer Failed'
    case 'transfer_success':
      return 'Transfer Success'
    case 'transfer_reconnected':
      return 'Transfer Reconnected'
    case 'room_connected':
      return 'Room Connected'
    case 'session_start':
      return 'Session Started'
    default:
      return eventType.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }
}

export function CallDetailSheet({ call, slug, open, onOpenChange, showEvents = false }: CallDetailSheetProps) {
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null)
  const [loadingRecording, setLoadingRecording] = useState(false)

  // Fetch agent events when call changes
  useEffect(() => {
    if (!call?.id) {
      setEvents([])
      return
    }

    const fetchEvents = async () => {
      setLoadingEvents(true)
      try {
        const response = await fetch(`/api/${slug}/calls/${call.id}/events`)
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
  }, [call?.id, slug])

  // Fetch call recording when call changes
  useEffect(() => {
    if (!call?.id) {
      setRecordingUrl(null)
      return
    }

    // If recording_url is already in the call object, use it
    // if (call.recording_url) {
    //   setRecordingUrl(call.recording_url)
    //   return
    // }

    const fetchRecording = async () => {
      setLoadingRecording(true)
      try {
        const response = await fetch(`/api/${slug}/calls/${call.id}/recording`)
        if (response.ok) {
          const data = await response.json()
          setRecordingUrl(data.recordingUrl || null)
        } else {
          // Recording not available yet or doesn't exist
          setRecordingUrl(null)
        }
      } catch (error) {
        console.error('Failed to fetch recording:', error)
        setRecordingUrl(null)
      } finally {
        setLoadingRecording(false)
      }
    }

    fetchRecording()
  }, [call?.id, call?.recording_url, slug])

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
          <TabsList className={`w-full grid ${showEvents ? 'grid-cols-5' : 'grid-cols-4'}`}>
            <TabsTrigger value="overview">
              <InfoIcon className="size-4" />
              <span className="ml-1 hidden sm:inline">Overview</span>
            </TabsTrigger>
            {showEvents && (
              <TabsTrigger value="events">
                <ActivityIcon className="size-4" />
                <span className="ml-1 hidden sm:inline">Events</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="timeline">
              <BarChart3Icon className="size-4" />
              <span className="ml-1 hidden sm:inline">Timeline</span>
            </TabsTrigger>
            <TabsTrigger value="cost">
              <CoinsIcon className="size-4" />
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
                    {events.filter(event => event.event_type !== 'metrics_collected').map((event, index, filteredEvents) => {
                      const eventTime = new Date(event.time)
                      const isLastEvent = index === filteredEvents.length - 1
                      
                      // Calculate time delta from previous event
                      let timeDelta: string | null = null
                      if (index > 0) {
                        const previousEventTime = new Date(filteredEvents[index - 1].time)
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
                                {event.event_type === 'conversation_item_added' && (() => {
                                  const itemData = event.data as { item?: { role?: string; content?: string[] }; textContent?: string; role?: string }
                                  const role = itemData.item?.role || itemData.role
                                  const content = itemData.item?.content?.[0] || itemData.textContent
                                  if (content) {
                                    return (
                                      <div className="mt-2 text-sm bg-muted/50 p-2 rounded text-muted-foreground">
                                        <span className="font-medium capitalize">{role}:</span> {content.substring(0, 100)}{content.length > 100 ? '...' : ''}
                                      </div>
                                    )
                                  }
                                  return null
                                })()}
                                
                                {event.event_type === 'user_input_transcribed' && (() => {
                                  const transcriptData = event.data as { transcript?: string; data?: { transcript?: string } }
                                  const transcript = transcriptData.data?.transcript || transcriptData.transcript
                                  if (transcript) {
                                    return (
                                      <div className="mt-2 text-sm bg-muted/50 p-2 rounded text-muted-foreground">
                                        &quot;{transcript}&quot;
                                      </div>
                                    )
                                  }
                                  return null
                                })()}
                                
                                {event.event_type === 'function_tools_executed' && (() => {
                                  const toolData = event.data as { functionCallsCount?: number }
                                  const count = toolData.functionCallsCount || 0
                                  return (
                                    <div className="mt-2 text-sm text-muted-foreground">
                                      {count} tool{count !== 1 ? 's' : ''} executed
                                    </div>
                                  )
                                })()}
                                
                                {event.event_type === 'transferred_to_team' && (() => {
                                  const transferData = event.data as { transferNumber?: string }
                                  if (transferData.transferNumber) {
                                    return (
                                      <div className="mt-2 text-sm text-muted-foreground">
                                        To: {transferData.transferNumber}
                                      </div>
                                    )
                                  }
                                  return null
                                })()}
                                
                                {event.event_type === 'agent_state_changed' && (() => {
                                  const stateData = event.data as { oldState?: string; newState?: string; data?: { old_state?: string; new_state?: string } }
                                  const oldState = stateData.data?.old_state || stateData.oldState
                                  const newState = stateData.data?.new_state || stateData.newState
                                  if (oldState && newState) {
                                    return (
                                      <div className="mt-2 text-sm">
                                        <span className="text-muted-foreground">{oldState}</span>
                                        <span className="mx-2">→</span>
                                        <span className="font-medium">{newState}</span>
                                      </div>
                                    )
                                  }
                                  return null
                                })()}
                                
                                {event.event_type === 'user_state_changed' && (() => {
                                  const stateData = event.data as { oldState?: string; newState?: string; data?: { old_state?: string; new_state?: string } }
                                  const oldState = stateData.data?.old_state || stateData.oldState
                                  const newState = stateData.data?.new_state || stateData.newState
                                  if (oldState && newState) {
                                    return (
                                      <div className="mt-2 text-sm">
                                        <span className="text-muted-foreground">{oldState}</span>
                                        <span className="mx-2">→</span>
                                        <span className="font-medium">{newState}</span>
                                      </div>
                                    )
                                  }
                                  return null
                                })()}
                                
                                {event.event_type === 'speech_created' && (() => {
                                  const speechData = event.data as { source?: string; userInitiated?: boolean; data?: { source?: string; user_initiated?: boolean } }
                                  const source = speechData.data?.source || speechData.source
                                  const userInitiated = speechData.data?.user_initiated ?? speechData.userInitiated
                                  if (source) {
                                    return (
                                      <div className="mt-2 text-sm text-muted-foreground">
                                        Source: {source} {userInitiated !== undefined && `• ${userInitiated ? 'User initiated' : 'Auto-generated'}`}
                                      </div>
                                    )
                                  }
                                  return null
                                })()}
                                
                                {event.event_type === 'knowledge_retrieved' && (() => {
                                  const knowledgeData = event.data as { data?: { query?: string; latency_ms?: number; context_length?: number; retrieved_context?: string } }
                                  const data = knowledgeData.data
                                  if (data) {
                                    return (
                                      <div className="mt-2 space-y-1.5">
                                        {data.query && (
                                          <div className="text-sm">
                                            <span className="text-muted-foreground">Query:</span> <span className="font-medium">&quot;{data.query}&quot;</span>
                                          </div>
                                        )}
                                        <div className="flex gap-3 text-xs text-muted-foreground">
                                          {data.latency_ms && (
                                            <span>Latency: {data.latency_ms}ms</span>
                                          )}
                                          {data.context_length && (
                                            <span>Context: {data.context_length} chars</span>
                                          )}
                                        </div>
                                        {data.retrieved_context && (
                                          <div className="text-xs bg-muted/50 p-2 rounded text-muted-foreground max-h-20 overflow-y-auto">
                                            {data.retrieved_context.substring(0, 200)}{data.retrieved_context.length > 200 ? '...' : ''}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  }
                                  return null
                                })()}
                                
                                {event.event_type === 'transcript' && (() => {
                                  const transcriptData = event.data as { data?: { items?: Array<{ role: string; content: string }> } }
                                  const items = transcriptData.data?.items
                                  if (items && items.length > 0) {
                                    return (
                                      <div className="mt-2 text-sm text-muted-foreground">
                                        {items.length} conversation item{items.length !== 1 ? 's' : ''} saved
                                      </div>
                                    )
                                  }
                                  return null
                                })()}
                                
                                {event.event_type === 'session_complete' && (() => {
                                  const sessionData = event.data as { data?: { usage?: { llmPromptTokens?: number; llmCompletionTokens?: number; ttsCharactersCount?: number; sttAudioDuration?: number }; durationMs?: number } }
                                  const data = sessionData.data
                                  if (data) {
                                    return (
                                      <div className="mt-2 space-y-1">
                                        {data.durationMs && (
                                          <div className="text-sm text-muted-foreground">
                                            Duration: {formatTimeDelta(data.durationMs)}
                                          </div>
                                        )}
                                        {data.usage && (
                                          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                            {data.usage.llmPromptTokens !== undefined && (
                                              <span>Prompt: {data.usage.llmPromptTokens.toLocaleString()} tokens</span>
                                            )}
                                            {data.usage.llmCompletionTokens !== undefined && (
                                              <span>Completion: {data.usage.llmCompletionTokens.toLocaleString()} tokens</span>
                                            )}
                                            {data.usage.ttsCharactersCount !== undefined && (
                                              <span>TTS: {data.usage.ttsCharactersCount.toLocaleString()} chars</span>
                                            )}
                                            {data.usage.sttAudioDuration !== undefined && (
                                              <span>STT: {data.usage.sttAudioDuration.toFixed(1)}s</span>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  }
                                  return null
                                })()}
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

          {/* Audio Timeline Tab */}
          <TabsContent value="timeline" className="mt-4">
            {recordingUrl && events.length > 0 ? (
              <AudioEventTimeline
                recordingUrl={recordingUrl}
                events={events}
                callStartTime={call.created_at}
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Audio Timeline</CardTitle>
                  <CardDescription>Recording timeline not available</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    {!recordingUrl && 'No recording available for this call'}
                    {recordingUrl && events.length === 0 && 'No events available for timeline'}
                  </div>
                </CardContent>
              </Card>
            )}
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
                {loadingRecording && (
                  <div className="mb-4 p-3 bg-muted/50 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <HeadphonesIcon className="size-4 text-primary animate-pulse" />
                      <span className="text-sm text-muted-foreground">Loading recording...</span>
                    </div>
                  </div>
                )}
                {!loadingRecording && recordingUrl && (
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
                      <source src={recordingUrl} type="audio/mpeg" />
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

