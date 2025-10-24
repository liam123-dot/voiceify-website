import { logger, wait } from "@trigger.dev/sdk/v3";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { KnowledgeBaseItem, DocumentChunk } from "@/types/knowledge-base";
import { processTextWithEmbeddings } from "@/lib/embeddings/processor";
import axios from "axios";
import type { ProcessResult } from "./url";

/**
 * Check if an error is a rate limit error
 */
function isRateLimitError(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    return error.response?.status === 429;
  }
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes("rate limit") || 
           message.includes("too many requests") ||
           message.includes("429");
  }
  return false;
}

/**
 * Extract retry-after delay from error response
 */
function getRetryAfterDelay(error: unknown, attemptNumber: number): number {
  if (axios.isAxiosError(error)) {
    const retryAfter = error.response?.headers['retry-after'];
    if (retryAfter) {
      const parsed = parseInt(retryAfter, 10);
      if (!isNaN(parsed)) {
        return parsed;
      }
      const retryDate = new Date(retryAfter);
      if (!isNaN(retryDate.getTime())) {
        return Math.max(0, Math.ceil((retryDate.getTime() - Date.now()) / 1000));
      }
    }
  }
  
  const baseDelay = Math.pow(2, attemptNumber) * 2;
  const jitter = Math.random() * 2;
  return Math.min(baseDelay + jitter, 120);
}

/**
 * Generate embeddings with retry logic for rate limits
 */
async function generateEmbeddingsWithRetry(
  text: string,
  chunkSize: number,
  chunkOverlap: number,
  maxRetries = 5
): Promise<Array<DocumentChunk & { embedding: number[] }>> {
  let lastError: unknown;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await processTextWithEmbeddings(text, chunkSize, chunkOverlap);
      
      if (attempt > 0) {
        logger.info("✅ Embeddings generated successfully after retry", { attempt: attempt + 1 });
      }
      
      return result;
      
    } catch (error) {
      lastError = error;
      
      if (isRateLimitError(error)) {
        if (attempt < maxRetries) {
          const delaySeconds = getRetryAfterDelay(error, attempt);
          logger.warn("⏸️  Rate limited by embedding provider, waiting before retry", {
            attempt: attempt + 1,
            maxRetries: maxRetries + 1,
            delaySeconds: delaySeconds.toFixed(1),
          });
          
          await wait.for({ seconds: delaySeconds });
          continue;
        }
      }
      
      if (attempt < maxRetries) {
        const delaySeconds = Math.min(Math.pow(2, attempt) * 1 + Math.random(), 30);
        logger.warn("⚠️  Error generating embeddings, retrying", {
          error: error instanceof Error ? error.message : String(error),
          attempt: attempt + 1,
          maxRetries: maxRetries + 1,
          delaySeconds: delaySeconds.toFixed(1)
        });
        
        await wait.for({ seconds: delaySeconds });
        continue;
      }
      
      throw error;
    }
  }
  
  throw lastError;
}

/**
 * Store document chunks with embeddings in database
 */
async function storeDocumentChunks(
  supabase: SupabaseClient,
  item: KnowledgeBaseItem,
  chunks: Array<DocumentChunk & { embedding: number[] }>
): Promise<number> {
  if (chunks.length === 0) {
    return 0;
  }

  logger.info("💾 Storing chunks in database", { totalChunks: chunks.length });

  const BATCH_SIZE = 50;
  let storedCount = 0;

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    
    const documents = batch.map((chunk) => ({
      knowledge_base_id: item.knowledge_base_id,
      knowledge_base_item_id: item.id,
      content: chunk.content,
      embedding: JSON.stringify(chunk.embedding),
      chunk_index: chunk.chunkIndex,
      chunk_total: chunk.chunkTotal,
      token_count: chunk.tokenCount,
      metadata: {},
    }));

    const { error: insertError } = await supabase
      .from("knowledge_base_documents")
      .insert(documents);

    if (insertError) {
      throw new Error(`Database error: ${insertError.message}`);
    }

    storedCount += documents.length;
    logger.info(`  ↳ Stored batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)}`, { 
      stored: storedCount,
      total: chunks.length 
    });
  }

  logger.info("✅ All chunks stored successfully", { totalStored: storedCount });

  return storedCount;
}

/**
 * Process a text-type knowledge base item
 */
export async function processText(
  supabase: SupabaseClient,
  item: KnowledgeBaseItem
): Promise<ProcessResult> {
  const startTime = Date.now();
  
  logger.info("📝 Processing text item", { 
    itemId: item.id,
    name: item.name
  });

  if (!item.text_content) {
    throw new Error("Text content is required for text-type items");
  }

  const textSizeKB = (item.text_content.length / 1024).toFixed(2);
  logger.info("📊 Text content loaded", { 
    sizeKB: `${textSizeKB} KB`,
    characters: item.text_content.length 
  });

  // Generate embeddings with built-in retry logic
  logger.info("🧮 Generating embeddings with retry support...");
  const chunksWithEmbeddings = await generateEmbeddingsWithRetry(
    item.text_content,
    item.chunk_size || 512,
    item.chunk_overlap || 50
  );
  
  const avgTokens = chunksWithEmbeddings.length > 0
    ? Math.round(chunksWithEmbeddings.reduce((sum, c) => sum + (c.tokenCount || 0), 0) / chunksWithEmbeddings.length)
    : 0;
  
  logger.info("✅ Embeddings generated", { 
    totalChunks: chunksWithEmbeddings.length,
    avgTokensPerChunk: avgTokens,
  });

  // Store chunks in database
  const chunksCreated = await storeDocumentChunks(
    supabase,
    item,
    chunksWithEmbeddings
  );

  const durationSec = ((Date.now() - startTime) / 1000);
  
  return {
    success: true,
    itemId: item.id,
    type: item.type,
    chunksCreated,
    durationSec,
  };
}

