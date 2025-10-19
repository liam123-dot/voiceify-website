-- ============================================
-- Evaluations Tables Migration
-- ============================================
-- Creates tables for evaluations and agent_evaluations
-- Evaluations process call transcripts with LLMs and produce structured outputs
-- ============================================

-- Create evaluations table
CREATE TABLE IF NOT EXISTS public.evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    prompt TEXT NOT NULL,
    model_provider VARCHAR(50) NOT NULL CHECK (model_provider IN ('openai', 'anthropic', 'google', 'custom-llm')),
    model_name VARCHAR(100) NOT NULL,
    output_schema JSONB NOT NULL,
    organization_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes for evaluations
CREATE INDEX IF NOT EXISTS idx_evaluations_organization_id ON public.evaluations(organization_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_model_provider ON public.evaluations(model_provider);

-- Create trigger for updated_at on evaluations
DROP TRIGGER IF EXISTS update_evaluations_updated_at ON public.evaluations;
CREATE TRIGGER update_evaluations_updated_at
    BEFORE UPDATE ON public.evaluations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create agent_evaluations junction table
CREATE TABLE IF NOT EXISTS public.agent_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    evaluation_id UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    -- Ensure an agent can't be assigned the same evaluation twice
    UNIQUE(agent_id, evaluation_id)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_agent_evaluations_agent_id ON public.agent_evaluations(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_evaluations_evaluation_id ON public.agent_evaluations(evaluation_id);

-- Add comments for documentation
COMMENT ON TABLE public.evaluations IS 'Evaluations that process call transcripts with LLMs and produce structured outputs';
COMMENT ON TABLE public.agent_evaluations IS 'Junction table linking agents to evaluations';
COMMENT ON COLUMN public.evaluations.prompt IS 'Prompt used to process call transcripts';
COMMENT ON COLUMN public.evaluations.model_provider IS 'LLM provider: openai, anthropic, google, or custom-llm';
COMMENT ON COLUMN public.evaluations.model_name IS 'Specific model to use for evaluation';
COMMENT ON COLUMN public.evaluations.output_schema IS 'JSON schema defining the structure of evaluation outputs';

