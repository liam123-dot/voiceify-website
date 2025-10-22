import { logger, schemaTask, wait } from "@trigger.dev/sdk/v3";
import z from "zod";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { KnowledgeBaseItem, DocumentChunk } from "@/types/knowledge-base";
import { processTextWithEmbeddings } from "@/lib/embeddings/processor";
import axios from "axios";

/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║           KNOWLEDGE BASE ITEM PROCESSING WITH SMART RETRIES           ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 * 
 * This task processes knowledge base items (URLs, text, files) and generates
 * embeddings with intelligent retry logic for rate limiting and transient errors.
 * 
 * RETRY STRATEGY:
 * ===============
 * 
 * 1. API-Level Retries (5 attempts each):
 *    • Firecrawl API (URL scraping)
 *    • Embedding Provider API (OpenAI, etc.)
 *    
 *    Rate Limits (429):
 *      - Respects Retry-After header when present
 *      - Exponential backoff: 2^attempt × 2 seconds + jitter
 *      - Max delay: 2 minutes per retry
 *      - Example: 4s → 8s → 16s → 32s → 64s
 *    
 *    Other Errors:
 *      - Shorter exponential backoff: 2^attempt seconds + jitter
 *      - Max delay: 30 seconds
 *      - Example: 2s → 4s → 8s → 16s → 30s
 * 
 * 2. Task-Level Retries (5 attempts):
 *    • Handles catastrophic failures that bypass API retries
 *    • Factor: 2.5x exponential backoff with jitter
 *    • Range: 2s minimum → 60s maximum
 *    • Example: 2s → 5s → 12s → 30s → 60s
 * 
 * TOTAL RESILIENCE:
 *   Up to 5 API retries × 5 task retries = 25 total attempts possible
 *   Most issues resolve within first 2-3 API retries
 * 
 * LOGGING:
 *   ⏸️  = Rate limited (waiting)
 *   ⚠️  = Transient error (retrying)
 *   🔄 = Task-level retry
 *   ✅ = Success
 *   ❌ = Final failure
 */

/**
 * Create Supabase client for Trigger.dev tasks
 * Cannot use Next.js-dependent server.ts in Trigger context
 */
function createSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
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
 * Fetch knowledge base item from database
 */
async function fetchKnowledgeBaseItem(
  supabase: SupabaseClient,
  itemId: string
): Promise<KnowledgeBaseItem> {
  const { data: items, error } = await supabase
    .from("knowledge_base_items")
    .select("*")
    .eq("id", itemId)
    .single();

  if (error) {
    logger.error("Error fetching knowledge base item", { error });
    throw error;
  }

  if (!items) {
    throw new Error("Knowledge base item not found");
  }

  return items as KnowledgeBaseItem;
}

/**
 * Update item status in database
 */
async function updateItemStatus(
  supabase: SupabaseClient,
  itemId: string,
  status: "pending" | "processing" | "indexed" | "failed",
  syncError?: string | null
): Promise<void> {
  const updates: Record<string, unknown> = { status };
  
  if (status === "indexed") {
    updates.last_synced_at = new Date().toISOString();
    updates.sync_error = null;
  } else if (status === "failed" && syncError) {
    updates.sync_error = syncError;
  }

  await supabase
    .from("knowledge_base_items")
    .update(updates)
    .eq("id", itemId);
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
 * Extract text content based on item type
 */
async function extractTextFromItem(item: KnowledgeBaseItem): Promise<string> {
  logger.info("📄 Extracting text content", { type: item.type });
  
  if (item.type === "url" && item.url) {
    return await fetchTextFromURL(item.url);
  } 
  
  if (item.type === "text" && item.text_content) {
    const sizeKB = (item.text_content.length / 1024).toFixed(2);
    logger.info("✅ Text content extracted", { sizeKB: `${sizeKB} KB` });
    return item.text_content;
  } 
  
  if (item.type === "file" && item.file_location) {
    throw new Error("File processing is not yet implemented");
  }
  
  throw new Error(`Unsupported item type: ${item.type}`);
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
 * Main task: Process a knowledge base item
 * 
 * Strategy:
 * - Uses medium-1x machine (1 vCPU, 2GB RAM) - balanced for most content
 * - Batch processing (50 chunks at a time) minimizes memory spikes
 * - Smart retry configuration with exponential backoff for rate limits
 * - Internal retries (5x) for API calls, task-level retries (5x) for hard failures
 * - Concurrency limited to avoid overwhelming APIs and rate limits
 * 
 * Memory efficiency:
 * - Chunks stored in batches of 50 instead of all at once
 * - Each batch is released from memory after storage
 * - For very large sites (1000+ chunks), this prevents OOM errors
 * 
 * Retry behavior:
 * - Rate limits (429): Exponential backoff with jitter, respects Retry-After header
 * - Transient errors: Shorter exponential backoff (2^attempt seconds)
 * - Hard failures: Task-level retry with longer delays
 */
export const processItem = schemaTask({
  id: "process-item",
  schema: z.object({
    knowledgeBaseItemId: z.string(),
  }),
  machine: "medium-1x", // 1 vCPU, 2GB RAM - good balance of cost and capability
  retry: {
    maxAttempts: 5, // Increased from 3 for better resilience
    factor: 2.5, // More aggressive exponential backoff
    minTimeoutInMs: 2000, // Start at 2 seconds
    maxTimeoutInMs: 60000, // Up to 1 minute between retries
    randomize: true, // Add jitter to prevent thundering herd
  },
  queue: {
    concurrencyLimit: 3, // Limit concurrent tasks to avoid API rate limits
  },
  run: async (payload: { knowledgeBaseItemId: string }, { ctx }) => {
    const startTime = Date.now();
    const supabase = createSupabaseClient();
    
    // Log machine size for debugging
    logger.info("🚀 Starting knowledge base item processing", { 
      attempt: ctx.attempt.number,
      maxAttempts: 3,
    });
    
    // Fetch the item
    const item = await fetchKnowledgeBaseItem(supabase, payload.knowledgeBaseItemId);
    logger.info("📋 Item details", { 
      id: item.id, 
      type: item.type, 
      name: item.name,
      chunkSize: item.chunk_size || 512,
      chunkOverlap: item.chunk_overlap || 50,
    });

    try {
      // Update status to processing
      await updateItemStatus(supabase, item.id, "processing");
      logger.info("🔄 Status updated to processing");

      // Extract text from item
      const text = await extractTextFromItem(item);
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

      // Update status to indexed
      await updateItemStatus(supabase, item.id, "indexed");
      
      const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.info("🎉 Processing completed successfully", { 
        itemId: item.id,
        chunksCreated,
        durationSec: `${durationSec}s`,
      });

      return {
        success: true,
        itemId: item.id,
        type: item.type,
        chunksCreated,
        durationSec: parseFloat(durationSec),
      };

    } catch (processingError) {
      const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
      const isRateLimit = isRateLimitError(processingError);
      
      logger.error(isRateLimit ? "⏸️  Rate limit error processing item" : "❌ Error processing item", { 
        error: processingError instanceof Error ? processingError.message : String(processingError),
        isRateLimitError: isRateLimit,
        durationSec: `${durationSec}s`,
        attempt: ctx.attempt.number,
        maxAttempts: 5,
      });
      
      const errorMessage = processingError instanceof Error 
        ? processingError.message 
        : "Unknown error during processing";
      
      // Only mark as failed if this is the last attempt
      if (ctx.attempt.number >= 5) {
        await updateItemStatus(supabase, item.id, "failed", errorMessage);
        logger.error("🔴 Max retries reached, marking item as failed", {
          totalAttempts: ctx.attempt.number,
          finalError: errorMessage,
          wasRateLimited: isRateLimit
        });
      } else {
        const nextAttempt = ctx.attempt.number + 1;
        logger.warn(`🔄 Will retry (attempt ${nextAttempt}/5)`, {
          nextAttempt,
          isRateLimitRetry: isRateLimit,
          errorType: isRateLimit ? "rate_limit" : "other"
        });
      }

      throw processingError;
    }
  },
});


