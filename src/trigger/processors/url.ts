import { logger, wait } from "@trigger.dev/sdk/v3";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { KnowledgeBaseItem, DocumentChunk } from "@/types/knowledge-base";
import { processTextWithEmbeddings } from "@/lib/embeddings/processor";
import axios from "axios";

/**
 * Process result type returned by all processors
 */
export interface ProcessResult {
  success: boolean;
  itemId: string;
  type: string;
  chunksCreated: number;
  durationSec: number;
}

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
 * Returns delay in seconds, defaults to exponential backoff if not present
 */
function getRetryAfterDelay(error: unknown, attemptNumber: number): number {
  if (axios.isAxiosError(error)) {
    const retryAfter = error.response?.headers['retry-after'];
    if (retryAfter) {
      // If it's a number, it's seconds
      const parsed = parseInt(retryAfter, 10);
      if (!isNaN(parsed)) {
        return parsed;
      }
      // If it's a date, calculate the difference
      const retryDate = new Date(retryAfter);
      if (!isNaN(retryDate.getTime())) {
        return Math.max(0, Math.ceil((retryDate.getTime() - Date.now()) / 1000));
      }
    }
  }
  
  // Default exponential backoff: 2^attempt * 2 seconds with jitter
  const baseDelay = Math.pow(2, attemptNumber) * 2;
  const jitter = Math.random() * 2; // 0-2 seconds of jitter
  return Math.min(baseDelay + jitter, 120); // Cap at 2 minutes
}

/**
 * Fetch and extract text from a URL using Firecrawl API
 * Handles rate limiting with exponential backoff
 */
async function fetchTextFromURL(url: string, maxRetries = 5): Promise<string> {
  logger.info("📥 Fetching content from URL", { url });

  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error("Firecrawl API key not configured");
  }

  let lastError: unknown;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post(
        "https://api.firecrawl.dev/v2/scrape",
        {
          url: url,
          formats: ["markdown"],
        },
        {
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 60000, // 60 second timeout
        }
      );

      if (!response.data.success || !response.data.data?.markdown) {
        throw new Error("No content extracted from URL via Firecrawl");
      }

      const contentLength = response.data.data.markdown.length;
      const sizeKB = (contentLength / 1024).toFixed(2);
      logger.info("✅ Content fetched successfully", { 
        sizeKB: `${sizeKB} KB`,
        contentLength,
        attempt: attempt > 0 ? attempt + 1 : undefined
      });

      return response.data.data.markdown;
      
    } catch (error) {
      lastError = error;
      
      // Check if it's a rate limit error
      if (isRateLimitError(error)) {
        if (attempt < maxRetries) {
          const delaySeconds = getRetryAfterDelay(error, attempt);
          logger.warn("⏸️  Rate limited by Firecrawl API, waiting before retry", {
            attempt: attempt + 1,
            maxRetries: maxRetries + 1,
            delaySeconds: delaySeconds.toFixed(1),
            retryIn: `${delaySeconds.toFixed(1)}s`
          });
          
          await wait.for({ seconds: delaySeconds });
          continue;
        }
      }
      
      // For other errors, retry with shorter delay
      if (attempt < maxRetries) {
        const delaySeconds = Math.min(Math.pow(2, attempt) * 1 + Math.random(), 30);
        logger.warn("⚠️  Error fetching from Firecrawl, retrying", {
          error: error instanceof Error ? error.message : String(error),
          attempt: attempt + 1,
          maxRetries: maxRetries + 1,
          delaySeconds: delaySeconds.toFixed(1)
        });
        
        await wait.for({ seconds: delaySeconds });
        continue;
      }
      
      // Final attempt failed
      throw error;
    }
  }
  
  throw lastError;
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
      
      // Check if it's a rate limit error
      if (isRateLimitError(error)) {
        if (attempt < maxRetries) {
          const delaySeconds = getRetryAfterDelay(error, attempt);
          logger.warn("⏸️  Rate limited by embedding provider, waiting before retry", {
            attempt: attempt + 1,
            maxRetries: maxRetries + 1,
            delaySeconds: delaySeconds.toFixed(1),
            retryIn: `${delaySeconds.toFixed(1)}s`
          });
          
          await wait.for({ seconds: delaySeconds });
          continue;
        }
      }
      
      // For other errors, retry with shorter delay
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
      
      // Final attempt failed
      throw error;
    }
  }
  
  throw lastError;
}

/**
 * Store document chunks with embeddings in database
 * Processes in batches to avoid memory issues with large datasets
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

  const BATCH_SIZE = 50; // Store 50 chunks at a time to avoid memory spikes
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
 * Process a URL-type knowledge base item
 */
export async function processUrl(
  supabase: SupabaseClient,
  item: KnowledgeBaseItem
): Promise<ProcessResult> {
  const startTime = Date.now();
  
  logger.info("🌐 Processing URL item", { 
    itemId: item.id,
    url: item.url,
    name: item.name
  });

  if (!item.url) {
    throw new Error("URL is required for url-type items");
  }

  // Fetch text from URL
  const text = await fetchTextFromURL(item.url);
  const textSizeKB = (text.length / 1024).toFixed(2);
  logger.info("📊 Text extraction complete", { 
    sizeKB: `${textSizeKB} KB`,
    characters: text.length 
  });

  // Generate embeddings with built-in retry logic
  logger.info("🧮 Generating embeddings with retry support...");
  const chunksWithEmbeddings = await generateEmbeddingsWithRetry(
    text,
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

  // Store chunks in database (batched internally)
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

