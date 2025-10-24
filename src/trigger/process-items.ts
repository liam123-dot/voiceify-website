import { logger, schemaTask } from "@trigger.dev/sdk/v3";
import z from "zod";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { KnowledgeBaseItem } from "@/types/knowledge-base";
import axios from "axios";
import { processUrl } from "./processors/url";
import { processText } from "./processors/text";
import { processRightmoveAgent } from "./processors/rightmove-agent";
import type { ProcessResult } from "./processors/url";

/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║      KNOWLEDGE BASE ITEM PROCESSING WITH MODULAR PROCESSORS           ║
 * ║                    & CONTEXTUAL RETRIEVAL (ANTHROPIC)                 ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 * 
 * This task processes knowledge base items using a modular processor architecture:
 * 
 * PROCESSOR ARCHITECTURE:
 * ======================
 * - Single task entry point (processItem) routes to type-specific processors
 * - Processors handle: URL, text, rightmove_agent, and future types
 * - Each processor is in a separate file for maintainability
 * - Shared utilities (Supabase, status updates) kept in this file
 * 
 * PROCESSORS:
 *   • url:              Fetches content via Firecrawl, generates embeddings
 *   • text:             Directly embeds provided text content
 *   • rightmove_agent:  Scrapes properties via Apify, creates child items
 *   • file:             (Not yet implemented)
 * 
 * CONTEXTUAL RETRIEVAL:
 * ====================
 * Implements Anthropic's Contextual Retrieval technique to improve search accuracy:
 * https://www.anthropic.com/engineering/contextual-retrieval
 * 
 * Benefits (per Anthropic's research):
 *   • 49% reduction in failed retrievals (embeddings + BM25)
 *   • 67% reduction with reranking
 *   • Chunks maintain context even when split from larger documents
 * 
 * RETRY STRATEGY:
 * ===============
 * 
 * 1. API-Level Retries (5 attempts each - handled in processors):
 *    • Firecrawl API (URL scraping)
 *    • Apify API (Rightmove scraping)
 *    • OpenRouter API (contextual generation)
 *    • Embedding Provider API (Voyage AI)
 *    
 *    Rate Limits (429):
 *      - Respects Retry-After header when present
 *      - Exponential backoff: 2^attempt × 2 seconds + jitter
 *      - Max delay: 2 minutes per retry
 *    
 * 2. Task-Level Retries (5 attempts - handled by Trigger.dev):
 *    • Handles catastrophic failures that bypass API retries
 *    • Factor: 2.5x exponential backoff with jitter
 *    • Range: 2s minimum → 60s maximum
 * 
 * LOGGING:
 *   ⏸️  = Rate limited (waiting)
 *   ⚠️  = Transient error (retrying)
 *   🔄 = Task-level retry
 *   ✅ = Success
 *   ❌ = Final failure
 */

/**
 * Type-specific processor registry
 * Add new processors here as they're implemented
 */
const PROCESSORS: Record<
  string,
  (supabase: SupabaseClient, item: KnowledgeBaseItem) => Promise<ProcessResult>
> = {
  url: processUrl,
  text: processText,
  rightmove_agent: processRightmoveAgent,
  // file: processFile, // TODO: Implement file processor
};

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
    
    logger.info("🚀 Starting knowledge base item processing", { 
      attempt: ctx.attempt.number,
      maxAttempts: 5,
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
      // Get the appropriate processor for this item type
      const processor = PROCESSORS[item.type];
      if (!processor) {
        throw new Error(
          `No processor found for item type: ${item.type}. ` +
          `Available types: ${Object.keys(PROCESSORS).join(', ')}`
        );
      }

      // Update status to processing (unless it's rightmove_agent which handles its own status)
      if (item.type !== 'rightmove_agent') {
        await updateItemStatus(supabase, item.id, "processing");
        logger.info("🔄 Status updated to processing");
      }

      // Route to type-specific processor
      logger.info(`  ↳ Routing to ${item.type} processor`);
      const result = await processor(supabase, item);

      // Update status to indexed (unless it's rightmove_agent which handles its own status)
      if (item.type !== 'rightmove_agent') {
        await updateItemStatus(supabase, item.id, "indexed");
      }
      
      const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.info("🎉 Processing completed successfully", { 
        itemId: item.id,
        type: item.type,
        chunksCreated: result.chunksCreated,
        durationSec: `${durationSec}s`,
      });

      return {
        success: true,
        itemId: item.id,
        type: item.type,
        chunksCreated: result.chunksCreated,
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


