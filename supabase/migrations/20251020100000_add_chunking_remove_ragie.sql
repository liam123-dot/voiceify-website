-- ============================================
-- Add Chunking Configuration and Remove Ragie
-- ============================================
-- Adds chunking configuration fields to knowledge_base_items
-- Removes Ragie-specific fields as we move to custom embeddings
-- ============================================

-- Add chunking configuration fields
ALTER TABLE public.knowledge_base_items
ADD COLUMN IF NOT EXISTS chunk_size INTEGER DEFAULT 512,
ADD COLUMN IF NOT EXISTS chunk_overlap INTEGER DEFAULT 50;

-- Remove Ragie-specific fields
ALTER TABLE public.knowledge_base_items
DROP COLUMN IF EXISTS ragie_document_id,
DROP COLUMN IF EXISTS ragie_indexed_at;

-- Drop Ragie-specific index if it exists
DROP INDEX IF EXISTS idx_knowledge_base_items_ragie_document_id;

-- Add comments for new fields
COMMENT ON COLUMN public.knowledge_base_items.chunk_size IS 'Number of tokens per chunk for embedding generation';
COMMENT ON COLUMN public.knowledge_base_items.chunk_overlap IS 'Number of overlapping tokens between chunks';

