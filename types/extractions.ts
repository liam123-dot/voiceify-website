// Custom Extractions Types

export type ExtractionModel = 'openai/gpt-5-nano' | 'openai/gpt-5-mini' | 'google/gemini-2.5-flash'

export type ExtractionStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface CustomExtraction {
  id: string
  knowledge_base_id: string
  parent_item_id: string
  name: string
  prompt: string
  model: ExtractionModel
  status: ExtractionStatus
  total_items: number
  processed_items: number
  failed_items: number
  created_at: string
  updated_at: string
  completed_at?: string | null
  created_by?: string | null
}

export interface ExtractionResult {
  id: string
  extraction_id: string
  knowledge_base_item_id: string
  extracted_data: string[] | Record<string, unknown>
  status: 'completed' | 'failed'
  error_message?: string | null
  created_at: string
}

export interface AggregatedResults {
  uniqueValues: Record<string, number>
  byProperty: Array<{
    propertyId: string
    propertyName: string
    extractedData: string[] | Record<string, unknown>
  }>
}

export interface CreateExtractionRequest {
  name: string
  prompt: string
  model: ExtractionModel
}

export interface ExtractionProgress {
  extraction: CustomExtraction
  results: ExtractionResult[]
  aggregated: AggregatedResults
}

