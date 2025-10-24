# Calls Data Model

## Overview

The `calls` table tracks all incoming calls to Clearsky AI agents. Each call record captures the complete lifecycle from initial connection through completion, including transcripts, usage metrics, and recordings.

## Table: `calls`

### Schema

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier for the call |
| `agent_id` | UUID | NOT NULL, REFERENCES agents(id) | Agent handling this call |
| `organization_id` | UUID | NOT NULL, REFERENCES organisations(id) | Organization that owns this call |
| `phone_number` | TEXT | - | **Deprecated**: Use `caller_phone_number` instead |
| `twilio_call_sid` | TEXT | - | Twilio CallSid - may change during SIP connection |
| `livekit_room_name` | TEXT | - | **Primary identifier**: LiveKit room name (most reliable) |
| `caller_phone_number` | TEXT | NOT NULL | Phone number of the person calling |
| `trunk_phone_number` | TEXT | - | Phone number of the agent/trunk being called |
| `status` | TEXT | NOT NULL, DEFAULT 'incoming' | Current call status |
| `transcript` | JSONB | - | Final conversation transcript as array of items |
| `usage_metrics` | JSONB | - | Usage metrics (tokens, TTS chars, STT duration) |
| `config` | JSONB | - | Agent configuration snapshot for this call |
| `recording_url` | TEXT | - | URL to call recording in Supabase Storage |
| `egress_id` | TEXT | - | LiveKit Egress ID for the recording |
| `ended_at` | TIMESTAMPTZ | - | When the call ended |
| `duration_seconds` | INTEGER | - | Call duration in seconds |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | When the call was initiated |

### Call Status Values

- `incoming` - Initial status when call is received
- `transferred_to_team` - Call transferred to a human team member
- `connected_to_agent` - Call connected to AI agent
- `completed` - Call has ended normally
- `failed` - Call failed for some reason

### Indexes

- `idx_calls_agent_id` - ON (agent_id)
- `idx_calls_organization_id` - ON (organization_id)
- `idx_calls_created_at` - ON (created_at DESC)
- `idx_calls_twilio_call_sid` - ON (twilio_call_sid)
- `idx_calls_status` - ON (status)
- `idx_calls_caller_phone_number` - ON (caller_phone_number)
- `idx_calls_transcript` - GIN index on transcript JSONB
- `idx_calls_usage_metrics` - GIN index on usage_metrics JSONB
- `idx_calls_config_model` - ON ((config->>'model'))
- `idx_calls_recording_url` - ON (recording_url)
- `idx_calls_egress_id` - ON (egress_id)

## Call Identification Strategy

When matching events to calls, use this priority order:

1. **LiveKit Room Name** (most reliable) - Set during `room_connected` event
2. **Twilio CallSid** (reliable for initial routing) - May change during SIP connection
3. **Agent ID + Caller Phone Number + Recent Timestamp** (fallback) - Used when identifiers unavailable

### Why This Matters

When Twilio connects to LiveKit via SIP, the CallSid can change. The `livekit_room_name` is set when the agent sends its first `room_connected` event and becomes the primary identifier for all subsequent event matching.

**Event Flow:**
1. Twilio webhook creates call record with initial `twilio_call_sid`
2. Agent sends `room_connected` event with `roomName` and potentially updated CallSid
3. System updates call record with `livekit_room_name` and accurate `twilio_call_sid`
4. All subsequent events use `roomName` as primary identifier

## Usage Metrics Structure

```typescript
{
  llmPromptTokens: number,
  llmPromptCachedTokens: number,
  llmCompletionTokens: number,
  llmInputAudioTokens?: number,
  llmOutputAudioTokens?: number,
  ttsCharactersCount: number,
  sttAudioDuration: number,
  totalTokens?: number
}
```

## Transcript Structure

Transcript is stored as an array of items, each item can be:

### Message Item
```typescript
{
  type: 'message',
  role: 'user' | 'assistant' | 'system',
  content: string,
  timestamp: string
}
```

### Function Call Item
```typescript
{
  type: 'function_call',
  name: string,
  callId: string,
  args: Record<string, any>,
  timestamp: string
}
```

### Function Call Output Item
```typescript
{
  type: 'function_call_output',
  name: string,
  callId: string,
  output: any,
  isError: boolean,
  timestamp: string
}
```

## Related Tables

### `agent_events`

All events related to a call are stored in the `agent_events` table with a foreign key reference to `calls.id`.

See [Agent Events documentation](./agent-events.md) for details.

## Metrics Events

Metrics events (`metrics_collected` and `total_latency`) are stored in the `agent_events` table with structured data for latency analysis.

### Structured Metrics Types

#### End-of-Utterance (EOU) Metrics
Emitted when the user finishes speaking. Includes turn detection and transcription latency.

```typescript
{
  metricType: 'eou',
  endOfUtteranceDelay: number,        // Time from speech end to turn completion (seconds)
  transcriptionDelay: number,          // Time from speech end to final transcript (seconds)
  onUserTurnCompletedDelay: number,   // Time to execute turn completion callback (seconds)
  speechId: string                     // Unique ID linking this turn's metrics
}
```

#### Speech-to-Text (STT) Metrics
Emitted after STT processes audio input.

```typescript
{
  metricType: 'stt',
  audioDuration: number,    // Duration of audio input (seconds)
  duration: number,         // Processing time (seconds, 0 for streaming)
  streamed: boolean         // True if using streaming STT
}
```

#### Large Language Model (LLM) Metrics
Emitted after LLM generates a completion.

```typescript
{
  metricType: 'llm',
  duration: number,               // Total generation time (seconds)
  completionTokens: number,       // Tokens in completion
  promptTokens: number,           // Tokens in prompt
  promptCachedTokens: number,     // Cached tokens in prompt
  ttft: number,                   // Time to first token (seconds)
  tokensPerSecond: number,        // Token generation rate
  speechId: string,               // Links to EOU/TTS metrics
  totalTokens: number             // Total tokens used
}
```

#### Text-to-Speech (TTS) Metrics
Emitted after TTS generates audio.

```typescript
{
  metricType: 'tts',
  audioDuration: number,     // Duration of generated audio (seconds)
  charactersCount: number,   // Characters in input text
  duration: number,          // Total generation time (seconds)
  ttfb: number,              // Time to first byte (seconds)
  speechId: string,          // Links to EOU/LLM metrics
  streamed: boolean          // True if using streaming TTS
}
```

#### Voice Activity Detection (VAD) Metrics
Emitted by the VAD model during speech detection.

```typescript
{
  metricType: 'vad',
  idleTime: number,                  // Time VAD was idle (seconds)
  inferenceCount: number,            // Number of VAD inferences performed
  inferenceDurationTotal: number,    // Total VAD inference time (seconds)
  label: string | null               // VAD model identifier
}
```

#### Total Latency Metrics
Calculated when all three components (EOU, LLM, TTS) are available for a speech turn.

```typescript
{
  metricType: 'total_latency',
  speechId: string,       // Links to related metrics
  totalLatency: number,   // Total user-experienced latency (seconds)
  eouDelay: number,       // EOU delay component (seconds)
  llmTtft: number,        // LLM TTFT component (seconds)
  ttsTtfb: number         // TTS TTFB component (seconds)
}
```

**Total Latency Formula:**
```
totalLatency = eouDelay + llmTtft + ttsTtfb
```

This represents the time from when the user stops speaking to when they start hearing the agent's response.

### Speech ID Linking

Each user turn generates a unique `speechId` that appears in:
- **EOUMetrics** - When user stops speaking
- **LLMMetrics** - When LLM processes the turn
- **TTSMetrics** - When TTS generates the response
- **TotalLatencyMetrics** - When all three are complete

This allows tracking the complete latency chain for each conversation turn.

### TTS-Aligned Transcriptions

The `speech_created` event captures TTS output with word-level timestamps when available:

```typescript
{
  type: 'speech_created',
  text: string,
  speechId: string,
  words?: Array<{
    word: string,
    startTime: number | null,  // Time in seconds
    endTime: number | null      // Time in seconds
  }>
}
```

### Call Latency Statistics

When a call completes, the system automatically calculates aggregate latency statistics and stores them in a `call_latency_stats` event. This provides a comprehensive performance summary for the entire call.

```typescript
{
  eou: {
    min: number,
    p50: number,
    p95: number,
    p99: number,
    avg: number,
    max: number,
    count: number
  } | null,
  llm: { /* same structure */ } | null,
  tts: { /* same structure */ } | null,
  total: { /* same structure */ } | null
}
```

**When Generated:**
- Automatically created when `session_complete` event is received
- Can be calculated on-demand via API endpoint: `/api/[slug]/calls/[callId]/latency-stats`
- Aggregates all metrics from `metrics_collected` and `total_latency` events
- Provides min, p50, p95, p99, avg, max, and sample count for each metric type

**Use Cases:**
- Performance monitoring and optimization
- Identifying problematic calls
- Understanding typical response times
- Setting SLA thresholds

**On-Demand Calculation:**
If latency statistics were not automatically generated (e.g., for older calls), they can be calculated on demand by calling the endpoint. The statistics will be calculated from available metrics data but not saved to the database.

## Query Examples

### Find recent calls for an agent
```sql
SELECT * FROM calls
WHERE agent_id = 'agent-uuid'
ORDER BY created_at DESC
LIMIT 10;
```

### Find call by LiveKit room name
```sql
SELECT * FROM calls
WHERE livekit_room_name = 'room-name';
```

### Find active calls (not completed)
```sql
SELECT * FROM calls
WHERE status NOT IN ('completed', 'failed')
  AND created_at > NOW() - INTERVAL '1 hour';
```

### Get calls with usage metrics
```sql
SELECT 
  id,
  agent_id,
  caller_phone_number,
  duration_seconds,
  usage_metrics->>'llmPromptTokens' as prompt_tokens,
  usage_metrics->>'llmCompletionTokens' as completion_tokens,
  usage_metrics->>'ttsCharactersCount' as tts_chars
FROM calls
WHERE usage_metrics IS NOT NULL
  AND created_at > NOW() - INTERVAL '7 days';
```

### Get latency metrics for a call
```sql
SELECT 
  event_type,
  time,
  data->>'metricType' as metric_type,
  data->>'speechId' as speech_id,
  -- EOU metrics
  (data->>'endOfUtteranceDelay')::float as eou_delay,
  -- LLM metrics
  (data->>'ttft')::float as llm_ttft,
  (data->>'tokensPerSecond')::float as tokens_per_sec,
  -- TTS metrics
  (data->>'ttfb')::float as tts_ttfb,
  -- Total latency
  (data->>'totalLatency')::float as total_latency
FROM agent_events
WHERE call_id = 'call-uuid'
  AND event_type IN ('metrics_collected', 'total_latency')
ORDER BY time;
```

### Find calls with high latency
```sql
SELECT 
  c.id,
  c.agent_id,
  c.caller_phone_number,
  ae.data->>'totalLatency' as total_latency,
  ae.data->>'speechId' as speech_id,
  ae.time
FROM calls c
JOIN agent_events ae ON c.id = ae.call_id
WHERE ae.event_type = 'total_latency'
  AND (ae.data->>'totalLatency')::float > 2.0  -- Latency > 2 seconds
  AND c.created_at > NOW() - INTERVAL '24 hours'
ORDER BY (ae.data->>'totalLatency')::float DESC;
```

### Analyze latency breakdown by component
```sql
SELECT 
  data->>'speechId' as speech_id,
  (data->>'eouDelay')::float as eou_delay,
  (data->>'llmTtft')::float as llm_ttft,
  (data->>'ttsTtfb')::float as tts_ttfb,
  (data->>'totalLatency')::float as total_latency,
  -- Calculate percentages
  ROUND(((data->>'eouDelay')::float / (data->>'totalLatency')::float) * 100, 1) as eou_pct,
  ROUND(((data->>'llmTtft')::float / (data->>'totalLatency')::float) * 100, 1) as llm_pct,
  ROUND(((data->>'ttsTtfb')::float / (data->>'totalLatency')::float) * 100, 1) as tts_pct
FROM agent_events
WHERE call_id = 'call-uuid'
  AND event_type = 'total_latency'
ORDER BY time;
```

### Get latency statistics for a call
```sql
SELECT 
  c.id,
  c.caller_phone_number,
  c.duration_seconds,
  (ae.data->'total'->>'avg')::float as avg_total_latency,
  (ae.data->'total'->>'p95')::float as p95_total_latency,
  (ae.data->'total'->>'count')::int as turn_count,
  (ae.data->'eou'->>'avg')::float as avg_eou,
  (ae.data->'llm'->>'avg')::float as avg_llm_ttft,
  (ae.data->'tts'->>'avg')::float as avg_tts_ttfb
FROM calls c
JOIN agent_events ae ON c.id = ae.call_id
WHERE ae.event_type = 'call_latency_stats'
  AND c.id = 'call-uuid';
```

### Find calls with high p95 latency
```sql
SELECT 
  c.id,
  c.agent_id,
  c.caller_phone_number,
  c.created_at,
  (ae.data->'total'->>'p95')::float as p95_latency,
  (ae.data->'total'->>'count')::int as turns
FROM calls c
JOIN agent_events ae ON c.id = ae.call_id
WHERE ae.event_type = 'call_latency_stats'
  AND (ae.data->'total'->>'p95')::float > 2.0
  AND c.created_at > NOW() - INTERVAL '7 days'
ORDER BY (ae.data->'total'->>'p95')::float DESC;
```

## Common Operations

### Creating a Call Record

When an incoming call is received:

```typescript
const { data, error } = await supabase
  .from('calls')
  .insert({
    agent_id: agentId,
    organization_id: orgId,
    caller_phone_number: from,
    trunk_phone_number: to,
    twilio_call_sid: callSid, // Initial CallSid from Twilio
    status: 'incoming',
  })
  .select('id')
  .single();
```

### Updating Call with Room Name

When `room_connected` event is received:

```typescript
await supabase
  .from('calls')
  .update({
    livekit_room_name: roomName,
    twilio_call_sid: actualCallSid, // Updated CallSid if different
  })
  .eq('id', callId);
```

### Completing a Call

When call ends:

```typescript
await supabase
  .from('calls')
  .update({
    status: 'completed',
    ended_at: new Date().toISOString(),
    duration_seconds: Math.floor((endedAt - createdAt) / 1000),
    transcript: transcriptItems,
    usage_metrics: usageData,
    recording_url: recordingUrl,
  })
  .eq('id', callId);
```

## Best Practices

1. **Always set `livekit_room_name`** during the `room_connected` event
2. **Use room name for matching** after it's set - don't rely solely on CallSid
3. **Store complete configuration snapshot** in `config` field for historical accuracy
4. **Record transcripts** with timestamps for each item
5. **Track usage metrics** for billing and analytics
6. **Handle CallSid changes** gracefully - update when receiving room_connected event

## Migration Notes

When updating the schema, remember to:
1. Update this documentation file
2. Create a new migration file in `supabase/migrations/`
3. Test with actual call flows
4. Update TypeScript types in `types/call-events.ts`

