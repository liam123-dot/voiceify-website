-- ============================================
-- Knowledge Base Tables Migration
-- ============================================
-- Creates tables for knowledge bases and their items
-- Integrates with Ragie for document indexing
-- ============================================

-- Create knowledge_bases table
CREATE TABLE IF NOT EXISTS public.knowledge_bases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    organization_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes for knowledge_bases
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_organization_id ON public.knowledge_bases(organization_id);

-- Create trigger for updated_at on knowledge_bases
DROP TRIGGER IF EXISTS update_knowledge_bases_updated_at ON public.knowledge_bases;
CREATE TRIGGER update_knowledge_bases_updated_at
    BEFORE UPDATE ON public.knowledge_bases
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create knowledge_base_items table
CREATE TABLE IF NOT EXISTS public.knowledge_base_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    
    -- Core fields
    name VARCHAR(500) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('file', 'url', 'text', 'notion', 'gdrive', 'onedrive', 'dropbox')),
    
    -- Content fields (use what's relevant for the type)
    url TEXT,
    text_content TEXT,
    file_type VARCHAR(100),
    file_location TEXT,
    file_size BIGINT,
    
    -- External connections (for synced items)
    connection_type VARCHAR(50),
    connection_id VARCHAR(255),
    external_id VARCHAR(500),
    external_url TEXT,
    external_modified_at TIMESTAMP WITH TIME ZONE,
    
    -- Ragie integration
    ragie_document_id VARCHAR(255) UNIQUE,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'indexed', 'failed')),
    ragie_indexed_at TIMESTAMP WITH TIME ZONE,
    
    -- Extensible metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Sync tracking
    last_synced_at TIMESTAMP WITH TIME ZONE,
    sync_error TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for knowledge_base_items
CREATE INDEX IF NOT EXISTS idx_knowledge_base_items_kb_id ON public.knowledge_base_items(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_items_type ON public.knowledge_base_items(type);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_items_connection_type ON public.knowledge_base_items(connection_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_items_external_id ON public.knowledge_base_items(connection_type, external_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_items_ragie_document_id ON public.knowledge_base_items(ragie_document_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_items_status ON public.knowledge_base_items(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_items_metadata ON public.knowledge_base_items USING gin (metadata);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_items_created_at ON public.knowledge_base_items(created_at);

-- Create trigger for updated_at on knowledge_base_items
DROP TRIGGER IF EXISTS update_knowledge_base_items_updated_at ON public.knowledge_base_items;
CREATE TRIGGER update_knowledge_base_items_updated_at
    BEFORE UPDATE ON public.knowledge_base_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create Supabase storage bucket for knowledge base files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'knowledge-base-files',
    'knowledge-base-files',
    false,
    104857600, -- 100MB limit
    ARRAY[
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv',
        'text/plain',
        'text/markdown'
    ]
)
ON CONFLICT (id) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE public.knowledge_bases IS 'Knowledge bases containing indexed documents for RAG';
COMMENT ON TABLE public.knowledge_base_items IS 'Items within knowledge bases, indexed with Ragie';
COMMENT ON COLUMN public.knowledge_base_items.ragie_document_id IS 'Document ID returned by Ragie after indexing';
COMMENT ON COLUMN public.knowledge_base_items.status IS 'Processing status: pending, processing, indexed, failed';
COMMENT ON COLUMN public.knowledge_base_items.file_location IS 'Storage path in format: knowledge-base-files/{org_id}/{kb_id}/{file_id}.ext';

