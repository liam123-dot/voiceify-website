import { logger, schemaTask } from "@trigger.dev/sdk/v3";
import z from "zod";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { KnowledgeBaseItem, DocumentChunk } from "@/types/knowledge-base";
import { processTextWithEmbeddings } from "@/lib/embeddings/processor";
import axios from "axios";

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
 */
async function fetchTextFromURL(url: string): Promise<string> {
  logger.info("📥 Fetching content from URL", { url });

  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error("Firecrawl API key not configured");
  }

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
    }
  );

  if (!response.data.success || !response.data.data?.markdown) {
    throw new Error("No content extracted from URL via Firecrawl");
  }

  const contentLength = response.data.data.markdown.length;
  const sizeKB = (contentLength / 1024).toFixed(2);
  logger.info("✅ Content fetched successfully", { 
    sizeKB: `${sizeKB} KB`,
    contentLength 
  });

  return response.data.data.markdown;
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
 * - Retry configuration handles transient failures (API timeouts, network issues)
 * - Concurrency limited to avoid overwhelming APIs and rate limits
 * 
 * Memory efficiency:
 * - Chunks stored in batches of 50 instead of all at once
 * - Each batch is released from memory after storage
 * - For very large sites (1000+ chunks), this prevents OOM errors
 */
export const processItem = schemaTask({
  id: "process-item",
  schema: z.object({
    knowledgeBaseItemId: z.string(),
  }),
  machine: "medium-1x", // 1 vCPU, 2GB RAM - good balance of cost and capability
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
    randomize: true,
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

      // Generate embeddings
      logger.info("🧮 Generating embeddings...");
      const chunksWithEmbeddings = await processTextWithEmbeddings(
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
      
      logger.error("❌ Error processing item", { 
        error: processingError instanceof Error ? processingError.message : String(processingError),
        durationSec: `${durationSec}s`,
        attempt: ctx.attempt.number,
      });
      
      const errorMessage = processingError instanceof Error 
        ? processingError.message 
        : "Unknown error during processing";
      
      // Only mark as failed if this is the last attempt
      if (ctx.attempt.number >= 3) {
        await updateItemStatus(supabase, item.id, "failed", errorMessage);
        logger.error("🔴 Max retries reached, marking item as failed");
      } else {
        logger.warn("⚠️  Retrying with larger machine...");
      }

      throw processingError;
    }
  },
});


