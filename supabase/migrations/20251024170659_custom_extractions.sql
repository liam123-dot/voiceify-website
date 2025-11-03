-- Custom Extractions System
-- Enables flexible AI-powered data extraction from knowledge base items

-- Table: knowledge_base_extractions
-- Stores extraction run configurations and metadata
CREATE TABLE knowledge_base_extractions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  parent_item_id UUID NOT NULL REFERENCES knowledge_base_items(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  prompt TEXT NOT NULL,
  model VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT fk_kb_extractions_knowledge_base FOREIGN KEY (knowledge_base_id) REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  CONSTRAINT fk_kb_extractions_parent_item FOREIGN KEY (parent_item_id) REFERENCES knowledge_base_items(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_kb_extractions_kb_id ON knowledge_base_extractions(knowledge_base_id);
CREATE INDEX idx_kb_extractions_parent_item ON knowledge_base_extractions(parent_item_id);
CREATE INDEX idx_kb_extractions_status ON knowledge_base_extractions(status);
CREATE INDEX idx_kb_extractions_created_at ON knowledge_base_extractions(created_at DESC);

-- Table: knowledge_base_item_extractions
-- Stores individual extraction results per property
CREATE TABLE knowledge_base_item_extractions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  extraction_id UUID NOT NULL REFERENCES knowledge_base_extractions(id) ON DELETE CASCADE,
  knowledge_base_item_id UUID NOT NULL REFERENCES knowledge_base_items(id) ON DELETE CASCADE,
  extracted_data JSONB NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'completed',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_item_extractions_extraction FOREIGN KEY (extraction_id) REFERENCES knowledge_base_extractions(id) ON DELETE CASCADE,
  CONSTRAINT fk_item_extractions_item FOREIGN KEY (knowledge_base_item_id) REFERENCES knowledge_base_items(id) ON DELETE CASCADE,
  CONSTRAINT unique_extraction_item UNIQUE (extraction_id, knowledge_base_item_id)
);

-- Indexes for performance
CREATE INDEX idx_item_extractions_extraction_id ON knowledge_base_item_extractions(extraction_id);
CREATE INDEX idx_item_extractions_item_id ON knowledge_base_item_extractions(knowledge_base_item_id);
CREATE INDEX idx_item_extractions_status ON knowledge_base_item_extractions(status);

-- Update trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION update_knowledge_base_extractions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_kb_extractions_updated_at
  BEFORE UPDATE ON knowledge_base_extractions
  FOR EACH ROW
  EXECUTE FUNCTION update_knowledge_base_extractions_updated_at();

