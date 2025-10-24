'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  PlayIcon, 
  PauseIcon, 
  ActivityIcon,
  ZapIcon,
  UserIcon,
  VolumeIcon,
  BookOpenIcon,
  MessageSquareIcon,
  RadioIcon
} from 'lucide-react'
import type { CallEventType } from '@/types/call-events'

interface AgentEvent {
  id: string
  time: string
  call_id: string
  event_type: CallEventType
  data: Record<string, unknown>
}

interface TimelineEvent {
  id: string
  type: CallEventType
  label: string
  start: number // seconds from recording start
  end: number | null // seconds from recording start, null if instant event
  color: string
  data: Record<string, unknown>
  state?: string // For state change events
}

interface AudioEventTimelineProps {
  recordingUrl: string
  events: AgentEvent[]
  callStartTime: string
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
}

function getEventColor(eventType: CallEventType, state?: string): string {
  // For state changes, use color based on the state
  if (eventType === 'agent_state_changed' || eventType === 'user_state_changed') {
    switch (state) {
      case 'speaking':
        return '#10b981' // green - speaking
      case 'listening':
        return '#3b82f6' // blue - listening
      case 'thinking':
        return '#8b5cf6' // purple - thinking
      case 'away':
        return '#6b7280' // gray - away
      default:
        return '#06b6d4' // cyan - other states
    }
  }
  
  switch (eventType) {
    case 'recording_started':
      return '#f59e0b' // orange - recording milestone
    case 'user_input_transcribed':
      return '#3b82f6' // blue - user
    case 'speech_created':
    case 'conversation_item_added':
      return '#10b981' // green - agent
    case 'function_tools_executed':
      return '#8b5cf6' // purple - tools
    case 'knowledge_retrieved':
      return '#f59e0b' // orange - knowledge
    case 'room_connected':
    case 'session_start':
      return '#6366f1' // indigo - session
    default:
      return '#6b7280' // gray - other
  }
}

function getEventIcon(eventType: CallEventType) {
  switch (eventType) {
    case 'recording_started':
      return <RadioIcon className="size-3" />
    case 'user_input_transcribed':
    case 'user_state_changed':
      return <UserIcon className="size-3" />
    case 'speech_created':
    case 'conversation_item_added':
      return <VolumeIcon className="size-3" />
    case 'function_tools_executed':
      return <ZapIcon className="size-3" />
    case 'knowledge_retrieved':
      return <BookOpenIcon className="size-3" />
    case 'agent_state_changed':
      return <ActivityIcon className="size-3" />
    default:
      return <MessageSquareIcon className="size-3" />
  }
}

function getEventLabel(eventType: CallEventType, state?: string): string {
  // For state changes, include the actual state in the label
  if (eventType === 'agent_state_changed' && state) {
    const stateLabel = state.charAt(0).toUpperCase() + state.slice(1)
    return `Agent: ${stateLabel}`
  }
  
  if (eventType === 'user_state_changed' && state) {
    const stateLabel = state.charAt(0).toUpperCase() + state.slice(1)
    return `User: ${stateLabel}`
  }
  
  switch (eventType) {
    case 'recording_started':
      return 'Recording Started'
    case 'room_connected':
      return 'Room Connected'
    case 'session_start':
      return 'Session Started'
    case 'user_input_transcribed':
      return 'User Speaking'
    case 'conversation_item_added':
      return 'Message Added'
    case 'function_tools_executed':
      return 'Tool Executed'
    case 'speech_created':
      return 'Speech Generated'
    case 'knowledge_retrieved':
      return 'Knowledge Retrieved'
    default:
      return eventType.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }
}

export function AudioEventTimeline({ recordingUrl, events, callStartTime }: AudioEventTimelineProps) {
  const waveformRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<WaveSurfer | null>(null)
  const regionsRef = useRef<RegionsPlugin | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [hoveredEvent, setHoveredEvent] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [activeEventId, setActiveEventId] = useState<string | null>(null)
  const eventsListRef = useRef<HTMLDivElement>(null)
  const eventRefsMap = useRef<Map<string, HTMLDivElement>>(new Map())

  // Process events to create timeline events with timing
  const timelineEvents = useMemo(() => {
    const processed: TimelineEvent[] = []
    
    // Prefer recording_started event for most accurate sync with the audio recording.
    // The recording_started event contains the precise timestamp from LiveKit egress
    // indicating when audio capture actually began. This is critical for synchronization
    // because there's a delay between room_connected and when recording starts
    // (during agent setup, configuration, etc).
    // Fallback to room_connected if recording wasn't enabled or event is missing.
    const recordingStartEvent = events.find(e => e.event_type === 'recording_started')
    const roomConnectedEvent = events.find(e => e.event_type === 'room_connected')
    
    const referenceEvent = recordingStartEvent || roomConnectedEvent
    if (!referenceEvent) {
      console.log('No recording_started or room_connected event found')
      return []
    }

    const recordingStart = new Date(referenceEvent.time).getTime()

    // Process events that occur after room_connected and have timing info
    events.forEach((event) => {
      const eventTime = new Date(event.time).getTime()
      
      // Skip events before room_connected
      if (eventTime < recordingStart) {
        return
      }

      // Calculate offset from recording start in seconds
      const startOffset = (eventTime - recordingStart) / 1000
      
      // Only include events that we want to visualize
      const visualizableEvents: CallEventType[] = [
        'recording_started',
        'room_connected',
        'session_start',
        'user_input_transcribed',
        'conversation_item_added',
        'function_tools_executed',
        'agent_state_changed',
        'user_state_changed',
        'speech_created',
        'knowledge_retrieved'
      ]

      if (!visualizableEvents.includes(event.event_type)) {
        return
      }

      // Try to determine end time based on event data
      let endOffset: number | null = null
      
      // For events with duration, try to extract it
      const eventData = event.data as { data?: { latency_ms?: number; new_state?: string } }
      if (eventData.data?.latency_ms) {
        endOffset = startOffset + (eventData.data.latency_ms / 1000)
      }
      
      // Extract state for state change events
      const state = eventData.data?.new_state

      processed.push({
        id: event.id,
        type: event.event_type,
        label: getEventLabel(event.event_type, state),
        start: startOffset,
        end: endOffset,
        color: getEventColor(event.event_type, state),
        data: event.data,
        state
      })
    })

    // Sort by start time
    return processed.sort((a, b) => a.start - b.start)
  }, [events, callStartTime])

  // Determine active event based on current playback time
  useEffect(() => {
    if (!isPlaying || timelineEvents.length === 0) {
      return
    }

    // Find the event that contains the current time or the most recent one
    let active: TimelineEvent | null = null
    
    for (const event of timelineEvents) {
      if (event.start <= currentTime) {
        // If event has an end time, check if we're within it
        if (event.end && currentTime <= event.end) {
          active = event
          break
        }
        // Otherwise, this is the most recent event so far
        active = event
      } else {
        // We've gone past the current time
        break
      }
    }

    const newActiveId = active?.id || null
    if (newActiveId !== activeEventId) {
      setActiveEventId(newActiveId)
      
      // Auto-scroll to the active event
      if (newActiveId && eventRefsMap.current.has(newActiveId)) {
        const eventElement = eventRefsMap.current.get(newActiveId)
        if (eventElement && eventsListRef.current) {
          eventElement.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
          })
        }
      }

      // Update waveform region to show active event
      if (regionsRef.current && wavesurferRef.current && isReady && active) {
        regionsRef.current.clearRegions()
        const regionEnd = active.end || active.start + 0.1
        regionsRef.current.addRegion({
          start: active.start,
          end: regionEnd,
          color: active.color + '30', // Add transparency
          drag: false,
          resize: false,
        })
      }
    }
  }, [currentTime, isPlaying, timelineEvents, activeEventId, isReady])

  // Clear active event when playback stops
  useEffect(() => {
    if (!isPlaying) {
      setActiveEventId(null)
      if (regionsRef.current) {
        regionsRef.current.clearRegions()
      }
    }
  }, [isPlaying])

  // Initialize WaveSurfer
  useEffect(() => {
    if (!waveformRef.current || wavesurferRef.current) return

    setIsLoading(true)

    const regions = RegionsPlugin.create()
    regionsRef.current = regions

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#e5e7eb',
      progressColor: '#6366f1',
      cursorColor: '#4f46e5',
      barWidth: 2,
      barGap: 1,
      height: 120,
      normalize: true,
      plugins: [regions],
    })

    wavesurferRef.current = ws

    ws.on('ready', () => {
      setDuration(ws.getDuration())
      setIsReady(true)
      setIsLoading(false)
    })

    ws.on('timeupdate', (time) => {
      setCurrentTime(time)
    })

    ws.on('play', () => setIsPlaying(true))
    ws.on('pause', () => setIsPlaying(false))

    ws.on('error', (error) => {
      console.error('WaveSurfer error:', error)
      setIsLoading(false)
    })

    // Load the audio
    ws.load(recordingUrl)

    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy()
        wavesurferRef.current = null
      }
    }
  }, [recordingUrl])

  const handlePlayPause = () => {
    if (wavesurferRef.current && isReady) {
      wavesurferRef.current.playPause()
    }
  }

  const handleEventClick = (event: TimelineEvent) => {
    if (wavesurferRef.current && isReady && duration > 0) {
      wavesurferRef.current.seekTo(event.start / duration)
    }
  }

  const handleEventHover = (event: TimelineEvent) => {
    setHoveredEvent(event.id)
    
    // Only show hover region if not playing (otherwise active event region is shown)
    if (!isPlaying && regionsRef.current && wavesurferRef.current && isReady) {
      // Clear existing regions
      regionsRef.current.clearRegions()
      
      // Add highlight region
      const regionEnd = event.end || event.start + 0.1 // Show a small marker for instant events
      
      regionsRef.current.addRegion({
        start: event.start,
        end: regionEnd,
        color: event.color + '40', // Add transparency
        drag: false,
        resize: false,
      })
    }
  }

  const handleEventLeave = () => {
    setHoveredEvent(null)
    // Only clear regions if not playing
    if (!isPlaying && regionsRef.current) {
      regionsRef.current.clearRegions()
    }
  }

  // Calculate metrics
  const metrics = useMemo(() => {
    const knowledgeEvents = timelineEvents.filter(e => e.type === 'knowledge_retrieved')
    const toolEvents = timelineEvents.filter(e => e.type === 'function_tools_executed')
    const userEvents = timelineEvents.filter(e => e.type === 'user_input_transcribed')
    const speechEvents = timelineEvents.filter(e => e.type === 'speech_created')

    const avgKnowledgeLatency = knowledgeEvents.length > 0
      ? knowledgeEvents.reduce((sum, e) => {
          const eventData = e.data as { data?: { latency_ms?: number } }
          const latency = eventData.data?.latency_ms || 0
          return sum + latency
        }, 0) / knowledgeEvents.length
      : 0

    return {
      totalEvents: timelineEvents.length,
      knowledgeRetrievals: knowledgeEvents.length,
      toolExecutions: toolEvents.length,
      userSpeakings: userEvents.length,
      agentSpeechings: speechEvents.length,
      avgKnowledgeLatency: avgKnowledgeLatency > 0 ? (avgKnowledgeLatency / 1000).toFixed(2) : null
    }
  }, [timelineEvents])

  if (timelineEvents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audio Timeline</CardTitle>
          <CardDescription>No timeline events available</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground text-sm">
            Timeline events require a recording and event timing data
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Audio Event Timeline</CardTitle>
        <CardDescription>
          Visualize events on the recording timeline • Hover to highlight • Click to jump
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Waveform */}
        <div className="bg-muted/30 rounded-lg p-4 border">
          <div ref={waveformRef} className="w-full" />
          {isLoading && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              Loading waveform...
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <Button
            onClick={handlePlayPause}
            disabled={!isReady}
            size="sm"
            variant="default"
          >
            {isPlaying ? (
              <>
                <PauseIcon className="size-4 mr-2" />
                Pause
              </>
            ) : (
              <>
                <PlayIcon className="size-4 mr-2" />
                Play
              </>
            )}
          </Button>
          <div className="text-sm text-muted-foreground">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>

        {/* Events List */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">
            Events Timeline ({timelineEvents.length})
          </div>
          <div ref={eventsListRef} className="space-y-1.5 max-h-[400px] overflow-y-auto pr-2">
            {timelineEvents.map((event) => {
              const isActive = activeEventId === event.id
              const isHovered = hoveredEvent === event.id
              
              return (
                <div
                  key={event.id}
                  ref={(el) => {
                    if (el) {
                      eventRefsMap.current.set(event.id, el)
                    } else {
                      eventRefsMap.current.delete(event.id)
                    }
                  }}
                  onClick={() => handleEventClick(event)}
                  onMouseEnter={() => handleEventHover(event)}
                  onMouseLeave={handleEventLeave}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    isActive
                      ? 'border-primary bg-primary/10 shadow-md ring-2 ring-primary/20'
                      : isHovered
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  }`}
                >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div
                      className="size-6 rounded flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: event.color + '20', color: event.color }}
                    >
                      {getEventIcon(event.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {event.label}
                      </div>
                      {(event.type === 'agent_state_changed' || event.type === 'user_state_changed') && (() => {
                        const eventData = event.data as { data?: { old_state?: string; new_state?: string } }
                        const oldState = eventData.data?.old_state
                        const newState = eventData.data?.new_state
                        return oldState && newState ? (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {oldState} → {newState}
                          </div>
                        ) : null
                      })()}
                      {event.type === 'knowledge_retrieved' && (() => {
                        const eventData = event.data as { data?: { query?: string } }
                        return eventData.data?.query ? (
                          <div className="text-xs text-muted-foreground truncate mt-0.5">
                            &quot;{eventData.data.query}&quot;
                          </div>
                        ) : null
                      })()}
                      {event.type === 'user_input_transcribed' && (() => {
                        const eventData = event.data as { data?: { transcript?: string }; transcript?: string }
                        const transcript = eventData.data?.transcript || eventData.transcript
                        return transcript ? (
                          <div className="text-xs text-muted-foreground truncate mt-0.5">
                            &quot;{transcript}&quot;
                          </div>
                        ) : null
                      })()}
                      {event.type === 'speech_created' && (() => {
                        const eventData = event.data as { data?: { source?: string; user_initiated?: boolean } }
                        const source = eventData.data?.source
                        const userInitiated = eventData.data?.user_initiated
                        return source ? (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Source: {source}{userInitiated !== undefined && ` • ${userInitiated ? 'User initiated' : 'Auto'}`}
                          </div>
                        ) : null
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
                    <span className="font-mono">
                      {formatTime(event.start)}
                      {event.end && ` → ${formatTime(event.end)}`}
                    </span>
                    {event.end && (
                      <span className="bg-muted px-1.5 py-0.5 rounded">
                        {(event.end - event.start).toFixed(2)}s
                      </span>
                    )}
                  </div>
                </div>
              </div>
              )
            })}
          </div>
        </div>

        {/* Metrics */}
        {metrics.totalEvents > 0 && (
          <div className="pt-4 border-t">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Timeline Metrics
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {metrics.knowledgeRetrievals > 0 && (
                <div>
                  <span className="text-muted-foreground">Knowledge Retrievals:</span>
                  <span className="ml-2 font-medium">{metrics.knowledgeRetrievals}</span>
                </div>
              )}
              {metrics.toolExecutions > 0 && (
                <div>
                  <span className="text-muted-foreground">Tool Executions:</span>
                  <span className="ml-2 font-medium">{metrics.toolExecutions}</span>
                </div>
              )}
              {metrics.userSpeakings > 0 && (
                <div>
                  <span className="text-muted-foreground">User Utterances:</span>
                  <span className="ml-2 font-medium">{metrics.userSpeakings}</span>
                </div>
              )}
              {metrics.agentSpeechings > 0 && (
                <div>
                  <span className="text-muted-foreground">Agent Responses:</span>
                  <span className="ml-2 font-medium">{metrics.agentSpeechings}</span>
                </div>
              )}
              {metrics.avgKnowledgeLatency && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Avg Knowledge Latency:</span>
                  <span className="ml-2 font-medium">{metrics.avgKnowledgeLatency}s</span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

