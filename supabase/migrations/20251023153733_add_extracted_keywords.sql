-- Add extracted_keywords column to store the results
ALTER TABLE public.knowledge_base_items
ADD COLUMN IF NOT EXISTS extracted_keywords TEXT[];

-- Add status column to track extraction state
ALTER TABLE public.knowledge_base_items
ADD COLUMN IF NOT EXISTS keyword_extraction_status VARCHAR(20);

-- Add constraint for valid status values
ALTER TABLE public.knowledge_base_items
ADD CONSTRAINT keyword_extraction_status_check 
CHECK (keyword_extraction_status IN ('pending', 'processing', 'completed', 'failed'));

-- Add index for querying items needing extraction
CREATE INDEX IF NOT EXISTS idx_kb_items_keyword_status 
ON public.knowledge_base_items(knowledge_base_id, keyword_extraction_status) 
WHERE keyword_extraction_status IS NOT NULL;

-- Add index for pending extractions
CREATE INDEX IF NOT EXISTS idx_kb_items_pending_keywords 
ON public.knowledge_base_items(knowledge_base_id) 
WHERE keyword_extraction_status IS NULL OR keyword_extraction_status = 'pending';

COMMENT ON COLUMN public.knowledge_base_items.extracted_keywords 
IS 'AI-extracted keywords for STT accuracy (null = not yet extracted)';

COMMENT ON COLUMN public.knowledge_base_items.keyword_extraction_status 
IS 'Status of keyword extraction: null (not started) | pending | processing | completed | failed';

