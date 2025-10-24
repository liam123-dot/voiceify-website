-- ============================================
-- Knowledge Base Documents Table with Vector Embeddings
-- ============================================
-- Creates table for storing document chunks with embeddings
-- Uses pgvector for semantic search capabilities
-- ============================================

-- Enable pgvector extension for vector embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Create knowledge_base_documents table for storing embeddings
CREATE TABLE IF NOT EXISTS public.knowledge_base_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign keys
    knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    knowledge_base_item_id UUID NOT NULL REFERENCES knowledge_base_items(id) ON DELETE CASCADE,
    
    -- Content and embeddings
    content TEXT NOT NULL,
    embedding vector(1536), -- Standard OpenAI embedding dimension, adjust if using different model
    
    -- Chunk metadata
    chunk_index INTEGER NOT NULL DEFAULT 0,
    chunk_total INTEGER,
    
    -- Token information
    token_count INTEGER,
    
    -- Page/section information (for PDFs, docs, etc.)
    page_number INTEGER,
    section_title TEXT,
    
    -- Extensible metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_kb_documents_kb_id ON public.knowledge_base_documents(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_kb_documents_kb_item_id ON public.knowledge_base_documents(knowledge_base_item_id);
CREATE INDEX IF NOT EXISTS idx_kb_documents_chunk_index ON public.knowledge_base_documents(knowledge_base_item_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_kb_documents_created_at ON public.knowledge_base_documents(created_at);
CREATE INDEX IF NOT EXISTS idx_kb_documents_metadata ON public.knowledge_base_documents USING gin (metadata);

-- Create vector similarity search index (using HNSW for fast approximate nearest neighbor search)
-- cosine distance is commonly used for text embeddings
CREATE INDEX IF NOT EXISTS idx_kb_documents_embedding ON public.knowledge_base_documents 
USING hnsw (embedding vector_cosine_ops);

-- Alternative indexes for different distance metrics (commented out by default)
-- Uncomment if you need L2 (Euclidean) or inner product distance
-- CREATE INDEX IF NOT EXISTS idx_kb_documents_embedding_l2 ON public.knowledge_base_documents 
-- USING hnsw (embedding vector_l2_ops);
-- CREATE INDEX IF NOT EXISTS idx_kb_documents_embedding_ip ON public.knowledge_base_documents 
-- USING hnsw (embedding vector_ip_ops);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_knowledge_base_documents_updated_at ON public.knowledge_base_documents;
CREATE TRIGGER update_knowledge_base_documents_updated_at
    BEFORE UPDATE ON public.knowledge_base_documents
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE public.knowledge_base_documents IS 'Document chunks with vector embeddings for semantic search';
COMMENT ON COLUMN public.knowledge_base_documents.embedding IS 'Vector embedding (1536 dimensions for OpenAI text-embedding-3-small/ada-002)';
COMMENT ON COLUMN public.knowledge_base_documents.content IS 'Text content that was embedded';
COMMENT ON COLUMN public.knowledge_base_documents.chunk_index IS 'Order of this chunk within the parent item';
COMMENT ON COLUMN public.knowledge_base_documents.chunk_total IS 'Total number of chunks for the parent item';

-- Create a helper function for similarity search across multiple knowledge bases
CREATE OR REPLACE FUNCTION match_knowledge_base_documents(
    query_embedding vector(1536),
    kb_ids UUID[],
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    knowledge_base_id UUID,
    knowledge_base_item_id UUID,
    content TEXT,
    similarity float,
    chunk_index INTEGER,
    metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        knowledge_base_documents.id,
        knowledge_base_documents.knowledge_base_id,
        knowledge_base_documents.knowledge_base_item_id,
        knowledge_base_documents.content,
        1 - (knowledge_base_documents.embedding <=> query_embedding) as similarity,
        knowledge_base_documents.chunk_index,
        knowledge_base_documents.metadata
    FROM knowledge_base_documents
    WHERE knowledge_base_documents.knowledge_base_id = ANY(kb_ids)
        AND 1 - (knowledge_base_documents.embedding <=> query_embedding) > match_threshold
    ORDER BY knowledge_base_documents.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION match_knowledge_base_documents IS 'Performs semantic similarity search across multiple knowledge bases using cosine distance. Accepts an array of knowledge base IDs.';

