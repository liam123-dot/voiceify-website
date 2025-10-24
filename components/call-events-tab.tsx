'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { CallEventType } from '@/types/call-events'

import {
  PhoneIcon,
  MessageSquareIcon,
  ActivityIcon,
  ArrowRightIcon,
  ZapIcon,
  BookOpenIcon,
  TimerIcon
} from 'lucide-react'

interface AgentEvent {
  id: string
  time: string
  call_id: string
  event_type: CallEventType
  data: Record<string, unknown>
}

interface CallEventsTabProps {
  slug: string
  callId: string
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

function getEventIcon(eventType: CallEventType) {
  switch (eventType) {
    case 'call_incoming':
      return <PhoneIcon className="size-4" />
    case 'transferred_to_team':
    case 'routed_to_agent':
    case 'team_no_answer_fallback':
      return <ArrowRightIcon className="size-4" />
    case 'room_connected':
      return <ActivityIcon className="size-4" />
    case 'conversation_item_added':
      return <MessageSquareIcon className="size-4" />
    case 'function_tools_executed':
      return <ZapIcon className="size-4" />
    case 'knowledge_retrieved':
    case 'knowledge_retrieved_with_speech':
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
    case 'room_connected':
      return 'Room Connected'
    case 'conversation_item_added':
      return 'Message'
    case 'function_tools_executed':
      return 'Tool Call'
    case 'knowledge_retrieved':
      return 'Knowledge Retrieved'
    case 'knowledge_retrieved_with_speech':
      return 'Knowledge Retrieved (with Speech ID)'
    default:
      return eventType.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }
}

export function CallEventsTab({ slug, callId }: CallEventsTabProps) {
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [loading, setLoading] = useState(false)

  // Fetch agent events when callId changes
  useEffect(() => {
    if (!callId) {
      setEvents([])
      return
    }

    const fetchEvents = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/${slug}/calls/${callId}/events`)
        if (response.ok) {
          const data = await response.json()
          const allEvents = data.events || []
          setEvents(allEvents)
        }
      } catch (error) {
        console.error('Failed to fetch events:', error)
        setEvents([])
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [callId, slug])

  return (
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
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading events...
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No events recorded for this call
          </div>
        ) : (
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
            {events.filter(event => {
              // Check if this is a total_latency metrics event (handle nested data structure)
              const eventData = event.data as { data?: { metricType?: string }; metricType?: string }
              const metricType = eventData.data?.metricType || eventData.metricType
              const isTotalLatencyEvent = metricType === 'total_latency'
              
              // Only show these specific event types
              const allowedTypes: CallEventType[] = [
                'call_incoming',
                'routed_to_agent',
                'transferred_to_team',
                'team_no_answer_fallback',
                'room_connected',
                'conversation_item_added',
                'function_tools_executed',
                'knowledge_retrieved',
                'knowledge_retrieved_with_speech'
              ]
              
              if (!allowedTypes.includes(event.event_type) && !isTotalLatencyEvent) {
                return false
              }
              
              // Filter out query_knowledge tool calls (already shown in knowledge_retrieved)
              if (event.event_type === 'function_tools_executed') {
                const toolData = event.data as { data?: { function_calls?: Array<{ name: string }> }; function_calls?: Array<{ name: string }> }
                const functionCalls = toolData.data?.function_calls || toolData.function_calls
                if (functionCalls && functionCalls.every(call => call.name === 'query_knowledge')) {
                  return false
                }
              }
              
              return true
            }).map((event, index, filteredEvents) => {
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
                      {(() => {
                        const eventData = event.data as { data?: { metricType?: string }; metricType?: string }
                        const metricType = eventData.data?.metricType || eventData.metricType
                        if (metricType === 'total_latency') {
                          return <TimerIcon className="size-4" />
                        }
                        return getEventIcon(event.event_type)
                      })()}
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 pb-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="font-medium text-sm">
                          {(() => {
                            const eventData = event.data as { data?: { metricType?: string }; metricType?: string }
                            const metricType = eventData.data?.metricType || eventData.metricType
                            if (metricType === 'total_latency') {
                              return 'Response Latency'
                            }
                            return getEventLabel(event.event_type)
                          })()}
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
                          const eventData = event.data as { data?: { item?: { role?: string; content?: string[] } }; item?: { role?: string; content?: string[] }; textContent?: string; role?: string }
                          // Handle nested data structure (data.data.item) or flat structure (data.item)
                          const item = eventData.data?.item || eventData.item
                          const role = item?.role || eventData.role
                          const content = item?.content?.[0] || eventData.textContent
                          if (content) {
                            return (
                              <div className="mt-2 text-sm bg-muted/50 p-2 rounded text-muted-foreground">
                                <span className="font-medium capitalize">{role}:</span> {content.substring(0, 100)}{content.length > 100 ? '...' : ''}
                              </div>
                            )
                          }
                          return null
                        })()}
                        
                        {event.event_type === 'function_tools_executed' && (() => {
                          const toolData = event.data as { data?: { functionCallsCount?: number }; functionCallsCount?: number }
                          const count = toolData.data?.functionCallsCount || toolData.functionCallsCount || 0
                          return (
                            <div className="mt-2 text-sm text-muted-foreground">
                              {count} tool{count !== 1 ? 's' : ''} executed
                            </div>
                          )
                        })()}
                        
                        {event.event_type === 'transferred_to_team' && (() => {
                          const transferData = event.data as { data?: { transferNumber?: string }; transferNumber?: string }
                          const transferNumber = transferData.data?.transferNumber || transferData.transferNumber
                          if (transferNumber) {
                            return (
                              <div className="mt-2 text-sm text-muted-foreground">
                                To: {transferNumber}
                              </div>
                            )
                          }
                          return null
                        })()}
                        
                        {(event.event_type === 'knowledge_retrieved' || event.event_type === 'knowledge_retrieved_with_speech') && (() => {
                          const knowledgeData = event.data as { data?: { query?: string; latency_ms?: number; context_length?: number; retrieved_context?: string; speechId?: string }; query?: string; latency_ms?: number; context_length?: number; retrieved_context?: string; speechId?: string }
                          // Handle both nested data structure and flat structure
                          const data = knowledgeData.data || knowledgeData
                          if (data && (data.query || data.retrieved_context)) {
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
                                  {data.speechId && (
                                    <span className="font-mono">Speech: {data.speechId.substring(0, 12)}...</span>
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
                        
                        {(() => {
                          const eventData = event.data as { data?: { totalLatency?: number; llmTtft?: number; ttsTtfb?: number; eouDelay?: number; metricType?: string }; totalLatency?: number; llmTtft?: number; ttsTtfb?: number; eouDelay?: number; metricType?: string }
                          const metricsData = eventData.data || eventData
                          if (metricsData.metricType === 'total_latency' && metricsData.totalLatency !== undefined) {
                            return (
                              <div className="mt-2 space-y-1.5">
                                <div className="text-sm">
                                  <span className="text-muted-foreground">Total Latency:</span> <span className="font-semibold text-primary">{(metricsData.totalLatency * 1000).toFixed(0)}ms</span>
                                </div>
                                <div className="flex gap-3 text-xs text-muted-foreground">
                                  {metricsData.llmTtft !== undefined && (
                                    <span>LLM: {(metricsData.llmTtft * 1000).toFixed(0)}ms</span>
                                  )}
                                  {metricsData.ttsTtfb !== undefined && (
                                    <span>TTS: {(metricsData.ttsTtfb * 1000).toFixed(0)}ms</span>
                                  )}
                                  {metricsData.eouDelay !== undefined && (
                                    <span>EOU: {(metricsData.eouDelay * 1000).toFixed(0)}ms</span>
                                  )}
                                </div>
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
  )
}

