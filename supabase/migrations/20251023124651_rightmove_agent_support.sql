-- ============================================
-- Rightmove Agent Support Migration
-- ============================================
-- Adds parent-child relationship to knowledge base items
-- Adds new item types: rightmove_agent, rightmove_property
-- ============================================

-- Add parent_item_id column for parent-child relationships
ALTER TABLE public.knowledge_base_items
ADD COLUMN IF NOT EXISTS parent_item_id UUID REFERENCES knowledge_base_items(id) ON DELETE CASCADE;

-- Create index on parent_item_id for efficient queries
CREATE INDEX IF NOT EXISTS idx_knowledge_base_items_parent_id ON public.knowledge_base_items(parent_item_id);

-- Drop existing type constraint
ALTER TABLE public.knowledge_base_items
DROP CONSTRAINT IF EXISTS knowledge_base_items_type_check;

-- Add updated type constraint with new types
ALTER TABLE public.knowledge_base_items
ADD CONSTRAINT knowledge_base_items_type_check 
CHECK (type IN ('file', 'url', 'text', 'notion', 'gdrive', 'onedrive', 'dropbox', 'rightmove_agent', 'rightmove_property'));

-- Comments for documentation
COMMENT ON COLUMN public.knowledge_base_items.parent_item_id IS 'Parent item ID for child items (e.g., properties under a rightmove_agent)';
COMMENT ON CONSTRAINT knowledge_base_items_type_check ON public.knowledge_base_items IS 'Item types: basic (file, url, text), connectors (notion, gdrive, onedrive, dropbox), and agents (rightmove_agent with rightmove_property children)';

