-- ============================================
-- Agent Knowledge Bases Junction Table
-- ============================================
-- Links agents to knowledge bases for retrieval
-- ============================================

-- Create agent_knowledge_bases junction table
CREATE TABLE IF NOT EXISTS public.agent_knowledge_bases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    -- Ensure an agent can't be assigned the same knowledge base twice
    UNIQUE(agent_id, knowledge_base_id)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_bases_agent_id ON public.agent_knowledge_bases(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_bases_knowledge_base_id ON public.agent_knowledge_bases(knowledge_base_id);

-- Add comment for documentation
COMMENT ON TABLE public.agent_knowledge_bases IS 'Junction table linking agents to knowledge bases for retrieval';

