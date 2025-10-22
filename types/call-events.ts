// ============================================
// Call Event Types
// ============================================
// Comprehensive types for all events tracked in the call tracking system

// Base event structure
export interface BaseEvent {
  type: string;
  timestamp: string;
  data: Record<string, any>;
  sessionId?: string;
  roomName?: string;
  twilioCallSid?: string;
  callerPhoneNumber?: string;
  metadata?: Record<string, any>;
}

// ============================================
// Routing Events
// ============================================

export interface CallIncomingEventData {
  caller: string;
  trunk: string;
  callSid: string;
}

export interface TransferredToTeamEventData {
  transferNumber: string;
  timeout: number;
  fallbackEnabled: boolean;
}

export interface TeamNoAnswerFallbackEventData {
  dialCallStatus: string;
  fallbackReason: string;
}

export interface RoutedToAgentEventData {
  direct: boolean;
}

export interface TransferInitiatedEventData {
  transferTarget: string;
  phoneNumber: string;
}

export interface TransferNoAnswerEventData {
  dialCallStatus: string;
  transferTarget?: string;
}

export interface TransferFailedEventData {
  dialCallStatus: string;
  reason: string;
}

export interface TransferSuccessEventData {
  dialCallStatus: string;
  transferTarget?: string;
}

// ============================================
// Agent Session Events
// ============================================

export interface RecordingStartedEventData {
  egressId: string;
  startedAtUnixMs: number;
  recordingFilename: string;
}

export interface ConversationItemAddedEventData {
  role: 'user' | 'assistant' | 'system';
  textContent: string;
  interrupted: boolean;
  id: string;
  offsetMs: number;
}

export interface UserInputTranscribedEventData {
  transcript: string;
  language: string;
  isFinal: boolean;
  speakerId: string;
  offsetMs: number;
}

export interface FunctionCall {
  name: string;
  arguments: Record<string, any>;
  id: string;
}

export interface FunctionExecution {
  call: FunctionCall;
  output: any;
}

export interface FunctionToolsExecutedEventData {
  functionCallsCount: number;
  executions: FunctionExecution[];
  offsetMs: number;
}

export interface AgentStateChangedEventData {
  oldState: string;
  newState: string;
  offsetMs: number;
}

export interface UserStateChangedEventData {
  oldState: string;
  newState: string;
  offsetMs: number;
}

export interface SpeechCreatedEventData {
  source: string;
  userInitiated: boolean;
  offsetMs: number;
  text?: string;
  speechId?: string;
  transcription?: {
    text: string | null;
  };
  words?: Array<{
    word: string;
    startTime: number | null;
    endTime: number | null;
  }>;
}

export interface LatencyStats {
  min: number;
  p50: number;
  p95: number;
  p99: number;
  avg: number;
  max: number;
  count: number;
}

export interface CallLatencyStatsEventData {
  eou: LatencyStats | null;
  llm: LatencyStats | null;
  tts: LatencyStats | null;
  total: LatencyStats | null;
}

// ============================================
// Structured Metrics Types
// ============================================

export interface EOUMetrics {
  metricType: 'eou';
  endOfUtteranceDelay: number;
  transcriptionDelay: number;
  onUserTurnCompletedDelay: number;
  speechId: string;
}

export interface STTMetrics {
  metricType: 'stt';
  audioDuration: number;
  duration: number;
  streamed: boolean;
}

export interface LLMMetrics {
  metricType: 'llm';
  duration: number;
  completionTokens: number;
  promptTokens: number;
  promptCachedTokens: number;
  ttft: number;
  tokensPerSecond: number;
  speechId: string;
  totalTokens: number;
}

export interface TTSMetrics {
  metricType: 'tts';
  audioDuration: number;
  charactersCount: number;
  duration: number;
  ttfb: number;
  speechId: string;
  streamed: boolean;
}

export interface VADMetrics {
  metricType: 'vad';
  idleTime: number;
  inferenceCount: number;
  inferenceDurationTotal: number;
  label?: string | null;
}

export interface TotalLatencyMetrics {
  metricType: 'total_latency';
  speechId: string;
  totalLatency: number;
  eouDelay: number;
  llmTtft: number;
  ttsTtfb: number;
}

export interface UnknownMetrics {
  metricType: 'unknown';
  typeName: string;
  [key: string]: any;
}

export type MetricsData = EOUMetrics | STTMetrics | LLMMetrics | TTSMetrics | VADMetrics | TotalLatencyMetrics | UnknownMetrics;

export interface MetricsCollectedEventData {
  metricsType?: string; // Legacy field
  metrics?: Record<string, any>; // Legacy field
  offsetMs?: number;
  // New structured format (union type allows either old or new format)
  metricType?: string;
  // All fields from structured metrics types
  [key: string]: any;
}

// ============================================
// Session Summary Events
// ============================================

export interface UsageMetrics {
  llmPromptTokens: number;
  llmPromptCachedTokens: number;
  llmCompletionTokens: number;
  audioInputTokens?: number;
  audioOutputTokens?: number;
  ttsCharactersCount: number;
  sttAudioDuration: number;
  totalTokens?: number;
}

export interface ConversationItem {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface SessionCompleteEventData {
  startedAt: string;
  endedAt: string;
  durationMs: number;
  usage: UsageMetrics;
  conversationItems: ConversationItem[];
  transcripts: string[];
  functionCalls: Array<{
    name: string;
    arguments: Record<string, any>;
  }>;
  config: {
    pipelineType: string;
    model: string;
    voice: string;
    noiseCancellation: boolean;
    transcription: boolean;
    recording: boolean;
    interruptible: boolean;
  };
  events?: Array<{
    type: string;
    timestamp: string;
    offsetMs: number;
    data: any;
  }>;
}

export interface TranscriptItem {
  type: 'message' | 'function_call' | 'function_call_output';
  role?: 'user' | 'assistant' | 'system';
  content?: string;
  name?: string;
  callId?: string;
  args?: Record<string, any>;
  output?: any;
  isError?: boolean;
  timestamp: string;
}

export interface TranscriptEventData {
  history: any;
  items: TranscriptItem[];
}

// ============================================
// Event Type Union
// ============================================

export type CallEventType =
  // Routing events
  | 'call_incoming'
  | 'transferred_to_team'
  | 'team_no_answer_fallback'
  | 'routed_to_agent'
  // Transfer events
  | 'transfer_initiated'
  | 'transfer_no_answer'
  | 'transfer_failed'
  | 'transfer_success'
  | 'transfer_reconnected'
  | 'room_connected'
  // Agent session events
  | 'session_start'
  | 'recording_started'
  | 'conversation_item_added'
  | 'user_input_transcribed'
  | 'function_tools_executed'
  | 'agent_state_changed'
  | 'user_state_changed'
  | 'speech_created'
  | 'metrics_collected'
  | 'total_latency'
  | 'knowledge_retrieved'
  // Summary events
  | 'session_complete'
  | 'transcript'
  | 'call_latency_stats';

export type CallEventData =
  | CallIncomingEventData
  | TransferredToTeamEventData
  | TeamNoAnswerFallbackEventData
  | RoutedToAgentEventData
  | TransferInitiatedEventData
  | TransferNoAnswerEventData
  | TransferFailedEventData
  | TransferSuccessEventData
  | RecordingStartedEventData
  | ConversationItemAddedEventData
  | UserInputTranscribedEventData
  | FunctionToolsExecutedEventData
  | AgentStateChangedEventData
  | UserStateChangedEventData
  | SpeechCreatedEventData
  | MetricsCollectedEventData
  | SessionCompleteEventData
  | TranscriptEventData;

// ============================================
// Database Types
// ============================================

export type CallStatus = 
  | 'incoming'
  | 'transferred_to_team'
  | 'connected_to_agent'
  | 'completed'
  | 'failed';

// Agent configuration stored with each call
// This is the complete agent configuration snapshot from when the call was made
// Stored as JSONB in the database, structure matches the agent's configuration
export type CallConfig = Record<string, any> & {
  pipelineType?: 'realtime' | 'pipeline';
  pipeline?: any;
  realtimeModel?: any;
  settings?: any;
  instructions?: string;
  tools?: any[];
  turnDetection?: any;
  noiseCancellation?: any;
}

export interface Call {
  id: string;
  agent_id: string;
  organization_id: string;
  twilio_call_sid: string | null;
  caller_phone_number: string;
  trunk_phone_number: string | null;
  status: CallStatus;
  created_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  transcript: TranscriptItem[] | null;
  usage_metrics: UsageMetrics | null;
  config: CallConfig | null;
  livekit_room_name: string | null;
}

export interface AgentEvent {
  time: string;
  call_id: string;
  event_type: CallEventType;
  data: CallEventData;
}

