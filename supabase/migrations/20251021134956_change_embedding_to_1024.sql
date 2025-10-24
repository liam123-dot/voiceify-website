-- ============================================
-- Change Embedding Dimension from 1536 to 1024
-- ============================================
-- Updates vector embeddings to use Voyage AI voyage-3.5-lite
-- which uses 1024 dimensions instead of OpenAI's 1536
-- WARNING: This will clear existing embeddings as they are incompatible
-- ============================================

-- Step 1: Drop the existing HNSW index (required before altering column)
DROP INDEX IF EXISTS idx_kb_documents_embedding;

-- Step 2: Set all existing embeddings to NULL (since 1536-dim embeddings are incompatible with 1024-dim)
UPDATE public.knowledge_base_documents SET embedding = NULL;

-- Step 3: Alter the embedding column from vector(1536) to vector(1024)
ALTER TABLE public.knowledge_base_documents 
ALTER COLUMN embedding TYPE vector(1024);

-- Step 4: Recreate the HNSW index with the new dimension
CREATE INDEX idx_kb_documents_embedding ON public.knowledge_base_documents 
USING hnsw (embedding vector_cosine_ops);

-- Step 5: Drop and recreate the match function with new vector dimension
-- Specify the exact function signature to drop
DROP FUNCTION IF EXISTS match_knowledge_base_documents(vector(1536), UUID[], float, int) CASCADE;

CREATE OR REPLACE FUNCTION match_knowledge_base_documents(
    query_embedding vector(1024),
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

-- Step 6: Update comments to reflect new embedding model
COMMENT ON COLUMN public.knowledge_base_documents.embedding IS 'Vector embedding (1024 dimensions for Voyage AI voyage-3.5-lite)';
COMMENT ON FUNCTION match_knowledge_base_documents(vector(1024), UUID[], float, int) IS 'Performs semantic similarity search across multiple knowledge bases using cosine distance. Accepts an array of knowledge base IDs. Uses 1024-dim Voyage AI embeddings.';

