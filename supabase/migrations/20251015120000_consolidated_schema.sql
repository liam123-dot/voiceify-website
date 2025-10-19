-- ============================================
-- Voiceify Database Schema - Consolidated Migration
-- ============================================
-- This migration sets up the complete database schema for Voiceify
-- Authentication is handled by WorkOS. Organization IDs are UUIDs
-- with foreign key references to the organisations table.
-- ============================================

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- USERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id TEXT NOT NULL UNIQUE, -- WorkOS user ID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_external_id ON public.users(external_id);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Users can view their own data" ON public.users
    FOR SELECT
    TO authenticated
    USING (true);

-- Add comment for documentation
COMMENT ON TABLE public.users IS 'User accounts synced with WorkOS';

-- ============================================
-- ORGANISATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.organisations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id TEXT NOT NULL UNIQUE, -- WorkOS organization ID
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    slug TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_organisations_external_id ON public.organisations(external_id);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_organisations_updated_at ON public.organisations;
CREATE TRIGGER update_organisations_updated_at
    BEFORE UPDATE ON public.organisations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Organisations can be viewed by authenticated users" ON public.organisations
    FOR SELECT
    TO authenticated
    USING (true);

-- Add comments for documentation
COMMENT ON TABLE public.organisations IS 'Organizations synced with WorkOS with permissions management';
COMMENT ON COLUMN public.organisations.permissions IS 'JSONB array of permission categories and individual permissions';

-- ============================================
-- AGENTS TABLE
-- ============================================

CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  configuration JSONB NOT NULL DEFAULT '{
    "pipelineType": "realtime",
    "instructions": "You are a helpful AI assistant. Be friendly, professional, and concise in your responses.",
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
      "recordSession": false,
      "interruptible": true
    }
  }'::jsonb,
  rules JSONB DEFAULT '{
    "timeBasedRouting": {
      "enabled": false,
      "schedules": []
    },
    "agentFallback": {
      "enabled": false,
      "timeoutSeconds": 30
    }
  }'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_agents_organization_id ON agents(organization_id);
CREATE INDEX idx_agents_configuration_pipeline_type ON agents((configuration->>'pipelineType'));

-- Constraints
ALTER TABLE agents ADD CONSTRAINT agents_pipeline_type_check 
  CHECK (configuration->>'pipelineType' IN ('realtime', 'pipeline'));

ALTER TABLE agents ADD CONSTRAINT agents_instructions_check 
  CHECK (length(configuration->>'instructions') >= 10);

-- Trigger
CREATE TRIGGER update_agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON COLUMN agents.configuration IS 'JSONB configuration for agent behavior, voice, and settings';
COMMENT ON COLUMN agents.rules IS 'Call routing rules including time-based routing and agent fallback settings';

-- ============================================
-- TOOLS TABLE
-- ============================================

CREATE TABLE tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name TEXT,
  label TEXT,
  description TEXT,
  type TEXT,
  function_schema JSONB,
  static_config JSONB,
  config_metadata JSONB,
  async BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_tools_organization_id ON tools(organization_id);
CREATE INDEX idx_tools_type ON tools(type);

-- Constraints
ALTER TABLE tools ADD CONSTRAINT tools_type_check 
  CHECK (type IN ('sms', 'transfer_call', 'api_request', 'pipedream_action'));

-- Trigger
CREATE TRIGGER update_tools_updated_at
  BEFORE UPDATE ON tools
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON COLUMN tools.async IS 'If true, the agent will not wait for the tool to complete before continuing';

-- ============================================
-- AGENT_TOOLS TABLE (Junction)
-- ============================================

CREATE TABLE agent_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(agent_id, tool_id)
);

-- Indexes
CREATE INDEX idx_agent_tools_agent_id ON agent_tools(agent_id);
CREATE INDEX idx_agent_tools_tool_id ON agent_tools(tool_id);

-- ============================================
-- PHONE_NUMBERS TABLE
-- ============================================

CREATE TABLE phone_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  friendly_name VARCHAR(100),
  credentials JSONB NOT NULL,
  metadata JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  webhook_configured BOOLEAN DEFAULT FALSE,
  webhook_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_verified_at TIMESTAMPTZ,
  UNIQUE(organization_id, phone_number)
);

-- Indexes
CREATE INDEX idx_phone_numbers_organization_id ON phone_numbers(organization_id);
CREATE INDEX idx_phone_numbers_provider ON phone_numbers(provider);
CREATE INDEX idx_phone_numbers_status ON phone_numbers(status);
CREATE INDEX idx_phone_numbers_phone_number ON phone_numbers(phone_number);
CREATE INDEX idx_phone_numbers_agent_id ON phone_numbers(agent_id);

-- Trigger
CREATE TRIGGER update_phone_numbers_updated_at
  BEFORE UPDATE ON phone_numbers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON COLUMN phone_numbers.agent_id IS 'The agent that this phone number is assigned to';
COMMENT ON COLUMN phone_numbers.webhook_configured IS 'Whether the provider webhook has been configured';
COMMENT ON COLUMN phone_numbers.webhook_url IS 'The webhook URL configured with the provider';

-- ============================================
-- CALLS TABLE
-- ============================================

CREATE TABLE calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  phone_number TEXT,
  twilio_call_sid TEXT,
  status TEXT NOT NULL DEFAULT 'incoming',
  caller_phone_number TEXT NOT NULL,
  trunk_phone_number TEXT,
  transcript JSONB,
  usage_metrics JSONB,
  config JSONB,
  recording_url TEXT,
  egress_id TEXT,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  livekit_room_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_calls_agent_id ON calls(agent_id);
CREATE INDEX idx_calls_organization_id ON calls(organization_id);
CREATE INDEX idx_calls_created_at ON calls(created_at DESC);
CREATE INDEX idx_calls_twilio_call_sid ON calls(twilio_call_sid);
CREATE INDEX idx_calls_status ON calls(status);
CREATE INDEX idx_calls_caller_phone_number ON calls(caller_phone_number);
CREATE INDEX idx_calls_transcript ON calls USING GIN (transcript);
CREATE INDEX idx_calls_usage_metrics ON calls USING GIN (usage_metrics);
CREATE INDEX idx_calls_config_model ON calls((config->>'model'));
CREATE INDEX idx_calls_recording_url ON calls(recording_url);
CREATE INDEX idx_calls_egress_id ON calls(egress_id);

-- Comments
COMMENT ON COLUMN calls.phone_number IS 'Deprecated: Use caller_phone_number instead. Made nullable for backward compatibility.';
COMMENT ON COLUMN calls.caller_phone_number IS 'Phone number of the person calling';
COMMENT ON COLUMN calls.trunk_phone_number IS 'Phone number of the agent/trunk being called';
COMMENT ON COLUMN calls.twilio_call_sid IS 'Twilio CallSid for reliable call matching across systems';
COMMENT ON COLUMN calls.status IS 'Call status: incoming, transferred_to_team, connected_to_agent, completed, failed';
COMMENT ON COLUMN calls.transcript IS 'Final conversation transcript as JSONB array of items (messages, function calls, etc.)';
COMMENT ON COLUMN calls.usage_metrics IS 'Usage metrics including token counts, TTS characters, STT duration, etc.';
COMMENT ON COLUMN calls.config IS 'Call configuration including model, pipeline type, voice, and settings';
COMMENT ON COLUMN calls.recording_url IS 'URL to the call recording in Supabase Storage';
COMMENT ON COLUMN calls.egress_id IS 'LiveKit Egress ID for the recording';

-- ============================================
-- AGENT_EVENTS TABLE
-- ============================================

CREATE TABLE agent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time TIMESTAMPTZ NOT NULL,
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Indexes
CREATE INDEX idx_agent_events_call_id_time ON agent_events(call_id, time DESC);
CREATE INDEX idx_agent_events_event_type_time ON agent_events(event_type, time DESC);
CREATE INDEX idx_agent_events_call_id_time_id ON agent_events(call_id, time DESC, id);

-- ============================================
-- STORAGE BUCKET FOR CALL RECORDINGS
-- ============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('call-recordings', 'call-recordings', false)
ON CONFLICT (id) DO NOTHING;

-- Note: Storage policies are handled at application level with WorkOS authentication

