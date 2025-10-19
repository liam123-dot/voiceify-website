# Calls Data Model

## Overview

The `calls` table tracks all incoming calls to Voiceify agents. Each call record captures the complete lifecycle from initial connection through completion, including transcripts, usage metrics, and recordings.

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

