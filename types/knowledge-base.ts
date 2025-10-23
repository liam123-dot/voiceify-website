// Knowledge Base Types

export interface ChunkingConfig {
  chunkSize: number;
  chunkOverlap: number;
}

export interface KnowledgeBaseItem {
  id: string;
  knowledge_base_id: string;
  name: string;
  type: 'file' | 'url' | 'text' | 'notion' | 'gdrive' | 'onedrive' | 'dropbox' | 'rightmove_agent' | 'rightmove_property';
  url?: string;
  text_content?: string;
  file_type?: string;
  file_location?: string;
  file_size?: number;
  connection_type?: string;
  connection_id?: string;
  external_id?: string;
  external_url?: string;
  external_modified_at?: string;
  parent_item_id?: string;
  status: 'pending' | 'processing' | 'indexed' | 'failed';
  chunk_size: number;
  chunk_overlap: number;
  metadata?: Record<string, unknown>;
  last_synced_at?: string;
  sync_error?: string;
  extracted_keywords?: string[] | null;
  keyword_extraction_status?: 'pending' | 'processing' | 'completed' | 'failed' | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface ProcessingStatus {
  status: 'pending' | 'processing' | 'indexed' | 'failed';
  error?: string;
  processedAt?: string;
}

export interface DocumentChunk {
  content: string;
  chunkIndex: number;
  chunkTotal?: number;
  tokenCount?: number;
  pageNumber?: number;
  sectionTitle?: string;
  metadata?: Record<string, unknown>;
}

export interface EmbeddingResult {
  embedding: number[];
  tokenCount: number;
}

// Rightmove Agent Types
export interface RightmoveAgentConfig {
  rentUrl?: string;
  saleUrl?: string;
  syncSchedule: 'daily' | 'weekly'; // Placeholder for future scheduling feature
}

