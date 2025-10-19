# Agents Table

## Schema

The `agents` table stores AI voice agents that belong to organizations.

### Columns

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key, auto-generated |
| `organization_id` | `uuid` | Foreign key to `organizations` table |
| `name` | `text` | Name of the agent (2-50 characters) |
| `configuration` | `jsonb` | Agent configuration (see Configuration Schema below) |
| `rules` | `jsonb` | Call routing rules (see Rules Schema below) |
| `created_at` | `timestamp with time zone` | Timestamp when the agent was created |
| `updated_at` | `timestamp with time zone` | Timestamp when the agent was last updated |

## Configuration Schema

The `configuration` column stores a JSONB object that defines the agent's behavior, model settings, and capabilities.

### TypeScript Interface

```typescript
interface AgentConfiguration {
  // Pipeline type: "realtime" for direct speech-to-speech or "pipeline" for STT-LLM-TTS
  pipelineType: 'realtime' | 'pipeline';
  
  // Instructions for the agent
  instructions: string;
  
  // Realtime model configuration (used when pipelineType = "realtime")
  realtimeModel?: {
    provider: 'openai' | 'azure-openai' | 'gemini' | 'nova-sonic';
    model: string; // e.g., "gpt-realtime-mini", "gpt-realtime-mini-2024-10-01"
    voice: string; // e.g., "alloy", "echo", "shimmer", "coral", "verse"
    temperature?: number; // 0.0 to 1.0
    modalities?: ('text' | 'audio')[]; // Response modalities
    apiKey?: string; // Optional custom API key
    apiEndpoint?: string; // Optional custom endpoint
  };
  
  // Pipeline configuration (used when pipelineType = "pipeline")
  pipeline?: {
    // Speech-to-Text configuration
    stt: {
      provider: string; // e.g., "assemblyai/universal-streaming:en", "deepgram/nova-2", "groq/whisper-large-v3"
      language?: string;
      apiKey?: string;
    };
    
    // Language Model configuration
    llm: {
      provider: string; // e.g., "openai/gpt-4.1-mini", "anthropic/claude-3-5-sonnet", "groq/llama-3.1-70b"
      model?: string;
      temperature?: number;
      maxTokens?: number;
      apiKey?: string;
      apiEndpoint?: string;
    };
    
    // Text-to-Speech configuration
    tts: {
      provider: string; // e.g., "cartesia/sonic-2:voice-id", "openai/tts-1", "elevenlabs/eleven-turbo-v2"
      voice: string;
      speed?: number;
      apiKey?: string;
    };
  };
  
  // Turn detection and VAD configuration
  turnDetection?: {
    type: 'multilingual' | 'server-vad' | 'disabled';
    vadProvider?: 'silero' | 'livekit'; // Voice Activity Detection provider
    vadOptions?: {
      minSpeechDuration?: number; // Minimum speech duration in ms
      silenceTimeout?: number; // Silence timeout in ms
      prefixPadding?: number; // Audio padding before speech in ms
      silenceThreshold?: number; // Silence threshold (0.0 to 1.0)
    };
  };
  
  // Noise cancellation
  noiseCancellation?: {
    enabled: boolean;
    type?: 'bvc' | 'krisp'; // Background Voice Cancellation
  };
  
  // Tools configuration (empty for now, but ready for future use)
  tools?: AgentTool[];
  
  // Additional settings
  settings?: {
    enableTranscription?: boolean; // Enable/disable transcription
    recordSession?: boolean; // Record the session
    maxDuration?: number; // Maximum session duration in seconds
    interruptible?: boolean; // Whether the agent can be interrupted
  };
}

interface AgentTool {
  id: string;
  name: string;
  description: string;
  parameters?: Record<string, any>;
  enabled: boolean;
}
```

### Example Configuration - Realtime Model

```json
{
  "pipelineType": "realtime",
  "instructions": "You are a helpful customer support agent. Be friendly, professional, and concise in your responses.",
  "realtimeModel": {
    "provider": "openai",
    "model": "gpt-realtime-mini",
    "voice": "alloy",
    "temperature": 0.8,
    "modalities": ["audio"]
  },
  "turnDetection": {
    "type": "server-vad",
    "vadProvider": "silero",
    "vadOptions": {
      "minSpeechDuration": 200,
      "silenceTimeout": 800,
      "prefixPadding": 300,
      "silenceThreshold": 0.5
    }
  },
  "noiseCancellation": {
    "enabled": true,
    "type": "bvc"
  },
  "tools": [],
  "settings": {
    "enableTranscription": true,
    "recordSession": true,
    "interruptible": true
  }
}
```

### Example Configuration - Pipeline (STT-LLM-TTS)

```json
{
  "pipelineType": "pipeline",
  "instructions": "You are a sales assistant for an e-commerce company. Help customers find products and answer their questions.",
  "pipeline": {
    "stt": {
      "provider": "assemblyai/universal-streaming:en",
      "language": "en"
    },
    "llm": {
      "provider": "openai/gpt-4.1-mini",
      "temperature": 0.7,
      "maxTokens": 500
    },
    "tts": {
      "provider": "cartesia/sonic-2:9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
      "voice": "9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
      "speed": 1.0
    }
  },
  "turnDetection": {
    "type": "multilingual",
    "vadProvider": "silero"
  },
  "noiseCancellation": {
    "enabled": true,
    "type": "bvc"
  },
  "tools": [],
  "settings": {
    "enableTranscription": true,
    "recordSession": false,
    "maxDuration": 3600,
    "interruptible": true
  }
}
```

### Example Configuration - Realtime with Separate TTS

```json
{
  "pipelineType": "realtime",
  "instructions": "You are a meditation guide. Speak slowly and calmly to help users relax.",
  "realtimeModel": {
    "provider": "openai",
    "model": "gpt-realtime-mini",
    "voice": "coral",
    "temperature": 0.9,
    "modalities": ["text"]
  },
  "pipeline": {
    "tts": {
      "provider": "elevenlabs/eleven-turbo-v2",
      "voice": "calm-meditation-voice",
      "speed": 0.9
    }
  },
  "turnDetection": {
    "type": "multilingual",
    "vadProvider": "silero"
  },
  "noiseCancellation": {
    "enabled": true,
    "type": "bvc"
  },
  "tools": [],
  "settings": {
    "enableTranscription": true,
    "recordSession": true,
    "interruptible": false
  }
}
```

### Indexes

- `agents_organization_id_idx` on `organization_id`

### Row Level Security (RLS)

RLS is enabled on this table. Policies ensure that:

- **INSERT**: Users can only create agents for organizations they belong to
- **SELECT**: Users can only view agents from organizations they belong to
- **UPDATE**: Users can only update agents from organizations they belong to
- **DELETE**: Users can only delete agents from organizations they belong to

### Triggers

- `update_agents_updated_at`: Automatically updates the `updated_at` column on record updates

## Usage

### Creating an Agent

Use the `/api/agents` POST endpoint:

```typescript
const response = await fetch('/api/agents', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ name: 'Customer Support Agent' }),
})

const data = await response.json()
// { agent: { id, organization_id, name, created_at, updated_at } }
```

### Fetching Agents

Use the `/api/agents` GET endpoint:

```typescript
const response = await fetch('/api/agents')
const data = await response.json()
// { agents: [...] }
```

## Relationships

- Each agent belongs to one organization (`organization_id` → `organizations.id`)
- Agents are automatically deleted when their organization is deleted (CASCADE)

## Rules Schema

The `rules` column stores a JSONB object that defines call routing rules for the agent.

### TypeScript Interface

```typescript
interface AgentRules {
  timeBasedRouting: TimeBasedRule
  agentFallback: AgentFallbackRule
}

interface TimeBasedRule {
  enabled: boolean
  schedules: Schedule[]
}

interface Schedule {
  id: string
  days: DayOfWeek[] // e.g., ["monday", "tuesday", "wednesday", "thursday", "friday"]
  startTime: string // e.g., "09:00"
  endTime: string // e.g., "17:00"
  transferTo: string // Phone number to transfer to during these hours
}

type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

interface AgentFallbackRule {
  enabled: boolean
  timeoutSeconds: number // How long to wait before falling back to agent (5-300 seconds)
}
```

### Example Rules Configuration

```json
{
  "timeBasedRouting": {
    "enabled": true,
    "schedules": [
      {
        "id": "schedule-1",
        "days": ["monday", "tuesday", "wednesday", "thursday", "friday"],
        "startTime": "09:00",
        "endTime": "17:00",
        "transferTo": "+1234567890"
      }
    ]
  },
  "agentFallback": {
    "enabled": true,
    "timeoutSeconds": 30
  }
}
```

### Rules Behavior

**Time-Based Routing:**
- When enabled, calls during scheduled hours (e.g., Mon-Fri 9:00-17:00) are transferred to the specified number
- Outside scheduled hours, calls go directly to the agent
- Multiple schedules can be configured with different days and times

**Agent Fallback:**
- When enabled, if a transferred call is not answered within the timeout period, it automatically routes to the agent
- Timeout can be set between 5-300 seconds
- This ensures no calls are lost even if the team is unavailable

## Migrations

- `20251007113444_create_agents_table.sql` - Initial agents table creation
- `20251009104301_add_agent_configuration.sql` - Added configuration JSONB column with constraints
- `20251009164237_add_agent_rules.sql` - Added rules JSONB column for call routing

## API Usage

### Updating Agent Configuration

Use the `/api/agents/[id]` PATCH endpoint to update an agent's configuration:

```typescript
const response = await fetch(`/api/agents/${agentId}`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    configuration: {
      pipelineType: 'realtime',
      instructions: 'You are a helpful assistant...',
      realtimeModel: {
        provider: 'openai',
        model: 'gpt-realtime-mini',
        voice: 'alloy',
        temperature: 0.8
      },
      settings: {
        enableTranscription: true,
        recordSession: false,
        interruptible: true
      }
      // ... more configuration options
    }
  })
})

const data = await response.json()
// { agent: { id, organization_id, name, configuration, created_at, updated_at } }
```

The API validates the configuration before saving and returns appropriate error messages if validation fails.

