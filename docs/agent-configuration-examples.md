# Agent Configuration Examples

This document provides examples of different agent configurations supported by the system. Each configuration can be stored in the `agents.configuration` JSONB column and used by the LiveKit agent to initialize the voice pipeline.

## Configuration Types

The system supports two main pipeline types:

1. **Realtime Models**: Direct speech-to-speech models (e.g., OpenAI Realtime API, Gemini Live API)
2. **Pipeline Mode**: Separate STT (Speech-to-Text), LLM (Language Model), and TTS (Text-to-Speech) components

You can also combine realtime models with custom TTS for maximum flexibility.

---

## Example 1: Realtime Model (OpenAI)

**Best for**: Natural conversations with emotional understanding, fastest latency

```json
{
  "pipelineType": "realtime",
  "instructions": "You are a helpful customer support agent. Be friendly, professional, and concise in your responses. Always greet users warmly and ask how you can help them today.",
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

**Available OpenAI Voices**:
- `alloy` - Neutral, balanced voice
- `echo` - Warm, friendly voice
- `shimmer` - Bright, upbeat voice
- `coral` - Calm, soothing voice
- `verse` - Professional voice

---

## Example 2: Pipeline Mode (STT-LLM-TTS)

**Best for**: Maximum control and flexibility over each component, custom LLM providers

```json
{
  "pipelineType": "pipeline",
  "instructions": "You are a sales assistant for an e-commerce company. Help customers find products and answer their questions. Be enthusiastic but not pushy.",
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

**Popular STT Providers**:
- `assemblyai/universal-streaming:en` - High accuracy, multi-language
- `deepgram/nova-2` - Fast, accurate transcription
- `groq/whisper-large-v3` - OpenAI Whisper via Groq

**Popular LLM Providers**:
- `openai/gpt-4.1-mini` - Fast, cost-effective
- `openai/gpt-4o` - Most capable
- `anthropic/claude-3-5-sonnet` - Excellent reasoning
- `groq/llama-3.1-70b` - Fast inference

**Popular TTS Providers**:
- `cartesia/sonic-2` - High quality, low latency
- `openai/tts-1` - Good quality, fast
- `elevenlabs/eleven-turbo-v2` - Natural, expressive voices

---

## Example 3: Realtime Model with Custom TTS

**Best for**: Emotional understanding with custom voice output

```json
{
  "pipelineType": "realtime",
  "instructions": "You are a meditation guide. Speak slowly and calmly to help users relax. Use gentle, encouraging language.",
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

> **Note**: When using a realtime model with separate TTS, set `modalities` to `["text"]` so the realtime model returns text instead of audio, which is then passed to the TTS provider.

---

## Example 4: Custom LLM with API Key

**Best for**: Using custom/self-hosted LLM providers or custom API keys

```json
{
  "pipelineType": "pipeline",
  "instructions": "You are a technical support specialist. Provide detailed, accurate solutions to technical problems.",
  "pipeline": {
    "stt": {
      "provider": "deepgram/nova-2",
      "language": "en",
      "apiKey": "your-custom-deepgram-key"
    },
    "llm": {
      "provider": "openai/gpt-4o",
      "temperature": 0.5,
      "maxTokens": 1000,
      "apiKey": "your-custom-openai-key",
      "apiEndpoint": "https://api.openai.com/v1"
    },
    "tts": {
      "provider": "elevenlabs/eleven-turbo-v2",
      "voice": "professional-voice-id",
      "speed": 1.1,
      "apiKey": "your-custom-elevenlabs-key"
    }
  },
  "turnDetection": {
    "type": "server-vad",
    "vadProvider": "silero",
    "vadOptions": {
      "minSpeechDuration": 300,
      "silenceTimeout": 1000,
      "prefixPadding": 200
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
    "maxDuration": 7200,
    "interruptible": true
  }
}
```

---

## Example 5: Multilingual Support

**Best for**: Supporting multiple languages in a single agent

```json
{
  "pipelineType": "pipeline",
  "instructions": "You are a multilingual customer service agent. You can speak English, Spanish, French, and German. Detect the user's language and respond in the same language.",
  "pipeline": {
    "stt": {
      "provider": "assemblyai/universal-streaming:multilingual",
      "language": "auto"
    },
    "llm": {
      "provider": "openai/gpt-4o",
      "temperature": 0.7,
      "maxTokens": 600
    },
    "tts": {
      "provider": "cartesia/sonic-2:multilingual",
      "voice": "multilingual-voice-id",
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
    "recordSession": true,
    "interruptible": true
  }
}
```

---

## Configuration Options Reference

### Pipeline Types

| Type | Description | Use Case |
|------|-------------|----------|
| `realtime` | Direct speech-to-speech | Fastest latency, emotional understanding |
| `pipeline` | Separate STT-LLM-TTS | Maximum control, custom providers |

### Turn Detection Types

| Type | Description |
|------|-------------|
| `multilingual` | Supports multiple languages |
| `server-vad` | Server-side voice activity detection |
| `disabled` | No automatic turn detection |

### VAD Providers

| Provider | Description |
|----------|-------------|
| `silero` | Silero VAD model (recommended) |
| `livekit` | LiveKit's built-in VAD |

### VAD Options

```typescript
{
  minSpeechDuration: 200,    // Min speech duration in ms
  silenceTimeout: 800,       // Silence timeout in ms
  prefixPadding: 300,        // Audio padding before speech in ms
  silenceThreshold: 0.5      // Silence threshold (0.0 to 1.0)
}
```

### Noise Cancellation Types

| Type | Description |
|------|-------------|
| `bvc` | Background Voice Cancellation |
| `krisp` | Krisp noise cancellation |

### Settings

```typescript
{
  enableTranscription: true,   // Enable/disable transcription
  recordSession: true,          // Record the session
  maxDuration: 3600,           // Max session duration in seconds
  interruptible: true          // Whether agent can be interrupted
}
```

---

## Tools Configuration (Future)

Tools will allow agents to call external services, query databases, and perform actions. The tools array is currently empty but will support configurations like:

```json
{
  "tools": [
    {
      "id": "search-products",
      "name": "search_products",
      "description": "Search for products in the inventory",
      "parameters": {
        "query": "string",
        "category": "string",
        "maxResults": "number"
      },
      "enabled": true
    }
  ]
}
```

---

## Migration Notes

When creating the database migration, the `configuration` column should be:

```sql
ALTER TABLE agents ADD COLUMN configuration JSONB NOT NULL DEFAULT '{
  "pipelineType": "realtime",
  "instructions": "You are a helpful AI assistant.",
  "realtimeModel": {
    "provider": "openai",
    "model": "gpt-realtime-mini",
    "voice": "alloy",
    "temperature": 0.8
  },
  "tools": [],
  "settings": {
    "enableTranscription": true,
    "interruptible": true
  }
}'::jsonb;
```

---

## Testing Your Configuration

To test your agent configuration:

1. Create an agent in the database with your desired configuration
2. Start the LiveKit agent worker
3. Create a room and join it
4. The agent will load the configuration from the API and initialize accordingly

The agent worker logs will show:
```
Loading configuration for client: <agent-id>
Loaded agent configuration: { pipelineType: 'realtime', ... }
```

---

## Additional Resources

- [LiveKit Agents Documentation](https://docs.livekit.io/agents/build/)
- [Realtime Models Guide](https://docs.livekit.io/agents/models/realtime/)
- [STT Providers](https://docs.livekit.io/agents/models/stt/)
- [LLM Providers](https://docs.livekit.io/agents/models/llm/)
- [TTS Providers](https://docs.livekit.io/agents/models/tts/)

