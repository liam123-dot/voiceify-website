import { logger, schemaTask, tasks, task } from "@trigger.dev/sdk/v3";
import z from "zod";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { KnowledgeBaseItem, DocumentChunk } from "@/types/knowledge-base";
import { extractTextFromHTML } from "@/lib/embeddings/processor";

import { ResourceMonitor } from "./resource-monitor";

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

// Helper to log memory usage
function logMemoryUsage(label: string) {
  const usage = process.memoryUsage();
  logger.log(`Memory [${label}]`, {
    heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
    rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
    external: `${Math.round(usage.external / 1024 / 1024)}MB`,
  });
}

// Middleware to enable the resource monitor
tasks.middleware("resource-monitor", async ({ ctx, next }) => {
  const resourceMonitor = new ResourceMonitor({
    ctx,
  });

  // Only enable the resource monitor if the environment variable is set
  // Reduced frequency to 5 seconds to minimize overhead
  if (process.env.RESOURCE_MONITOR_ENABLED === "1") {
    resourceMonitor.startMonitoring(5_000);
  }

  await next();

  resourceMonitor.stopMonitoring();
});


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
 * Fetch and extract text from a URL
 */
async function fetchTextFromURL(url: string): Promise<string> {
  logger.log("Fetching URL", { url });

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; KnowledgeBaseBot/1.0)',
      },
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const text = extractTextFromHTML(html);
    
    if (!text || text.trim().length === 0) {
      throw new Error("No text content extracted from URL");
    }

    logger.log("Successfully extracted text from URL", { 
      textLength: text.length,
      url 
    });

    return text;
  } catch (error) {
    const errorMsg = error instanceof Error 
      ? error.message 
      : "Unknown error";
    logger.error("URL fetch error", { error, url });
    throw new Error(`Failed to fetch URL: ${errorMsg}`);
  }
}

/**
 * Fetch and extract text from a URL using Firecrawl API directly
 * Firecrawl provides better scraping with JavaScript rendering and cleaner content extraction
 * Using direct API calls instead of SDK to reduce memory overhead
 */
async function fetchTextFromURLWithFirecrawl(url: string): Promise<string> {
  logger.log("=== STEP 1: Starting Firecrawl fetch ===", { url });
  logMemoryUsage("Before Firecrawl scrape");

  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    logger.error("FIRECRAWL_API_KEY not configured");
    throw new Error("Firecrawl API key not configured");
  }

  logger.log("=== STEP 2: API key validated ===");

  try {
    const requestPayload = {
      url: url,
      formats: ["markdown"], // Only request markdown to minimize response size
      maxAge: 0, // Force fresh content
    };

    logger.log("=== STEP 3: Sending Firecrawl API request ===", { 
      apiUrl: "https://api.firecrawl.dev/v2/scrape",
      payload: requestPayload 
    });

    const fetchStartTime = Date.now();

    // Call Firecrawl v2 API directly with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const fetchDuration = Date.now() - fetchStartTime;
    logger.log("=== STEP 4: Received response from Firecrawl ===", { 
      status: response.status,
      statusText: response.statusText,
      duration: `${fetchDuration}ms`,
      ok: response.ok,
    });

    if (!response.ok) {
      logger.log("=== STEP 5: Response not OK, reading error text ===");
      const errorText = await response.text();
      logger.error("Firecrawl API error", { 
        status: response.status, 
        statusText: response.statusText,
        error: errorText 
      });
      throw new Error(`Firecrawl API error ${response.status}: ${errorText}`);
    }

    logger.log("=== STEP 6: Parsing JSON response ===");
    const parseStartTime = Date.now();
    const result = await response.json();
    const parseDuration = Date.now() - parseStartTime;
    
    logger.log("=== STEP 7: JSON parsed successfully ===", { 
      duration: `${parseDuration}ms`,
      hasData: !!result.data,
      success: result.success,
    });

    if (!result.success) {
      logger.error("Firecrawl scrape failed - success=false", { result });
      throw new Error("Firecrawl scrape failed");
    }

    logger.log("=== STEP 8: Extracting markdown from result ===");
    // Extract markdown from response
    const markdown = result.data?.markdown;
    
    if (!markdown || markdown.trim().length === 0) {
      logger.error("No markdown in response", { 
        hasData: !!result.data,
        dataKeys: result.data ? Object.keys(result.data) : [],
      });
      throw new Error("No text content extracted from URL via Firecrawl");
    }

    logger.log("=== STEP 9: Successfully extracted markdown ===", {
      textLength: markdown.length,
      url,
      sourceURL: result.data?.metadata?.sourceURL,
      statusCode: result.data?.metadata?.statusCode,
      totalDuration: `${Date.now() - fetchStartTime}ms`,
    });

    logMemoryUsage("After Firecrawl scrape");
    logger.log("=== STEP 10: Returning markdown (Firecrawl complete) ===");

    return markdown;
  } catch (error) {
    const errorMsg = error instanceof Error 
      ? error.message 
      : "Unknown error";
    
    logger.error("=== FIRECRAWL ERROR ===", { 
      error,
      errorMessage: errorMsg,
      errorName: error instanceof Error ? error.name : "Unknown",
      url,
    });
    
    throw new Error(`Failed to fetch URL with Firecrawl: ${errorMsg}`);
  }
}

/**
 * Extract text content based on item type
 */
async function extractTextFromItem(item: KnowledgeBaseItem): Promise<string> {
  logger.log(">>> EXTRACT: Starting text extraction", { type: item.type, hasUrl: !!item.url });
  
  if (item.type === "url" && item.url) {
    logger.log(">>> EXTRACT: Processing URL type", { url: item.url });
    // Try Firecrawl first, fall back to basic fetch if it fails
    try {
      logger.log(">>> EXTRACT: Calling Firecrawl");
      const result = await fetchTextFromURLWithFirecrawl(item.url);
      logger.log(">>> EXTRACT: Firecrawl returned successfully", { resultLength: result.length });
      return result;
    } catch (firecrawlError) {
      logger.warn(">>> EXTRACT: Firecrawl failed, falling back to basic fetch", { 
        error: firecrawlError,
        url: item.url 
      });
      const fallbackResult = await fetchTextFromURL(item.url);
      logger.log(">>> EXTRACT: Fallback fetch successful", { resultLength: fallbackResult.length });
      return fallbackResult;
    }
  } 
  
  if (item.type === "text" && item.text_content) {
    logger.log(">>> EXTRACT: Using text content from item", { 
      textLength: item.text_content.length 
    });
    return item.text_content;
  } 
  
  if (item.type === "file" && item.file_location) {
    logger.log(">>> EXTRACT: File type not implemented", { 
      fileLocation: item.file_location,
      fileType: item.file_type 
    });
    throw new Error("File processing is not yet implemented. Please use text or URL items for now.");
  }
  
  logger.error(">>> EXTRACT: Unsupported item type", { type: item.type });
  throw new Error(`Unsupported item type or missing data: ${item.type}`);
}

/**
 * Generate embeddings for text content in batches
 * Returns total number of chunks processed
 */
async function generateAndStoreEmbeddingsBatched(
  supabase: SupabaseClient,
  item: KnowledgeBaseItem,
  text: string,
  chunkSize: number,
  chunkOverlap: number
): Promise<number> {
  if (!text || text.trim().length === 0) {
    throw new Error("No text content to process");
  }

  logger.log("📊 BATCH: Starting batched text chunking and embedding generation", {
    textLength: text.length,
    chunkSize,
    chunkOverlap
  });
  logMemoryUsage("Before chunking");

  try {
    // Import chunking and embedding functions
    logger.log("📊 BATCH: Importing embedding processor functions");
    const { chunkText, generateEmbedding } = await import("@/lib/embeddings/processor");
    logger.log("✅ BATCH: Functions imported");
    
    // First, chunk the text
    logger.log("📊 BATCH: Starting text chunking");
    const chunks = await chunkText(text, chunkSize, chunkOverlap);
    logger.log("✅ BATCH: Text chunked", { chunkCount: chunks.length });
    
    // Process and store in batches to avoid memory buildup
    const BATCH_SIZE = 10;
    let totalProcessed = 0;
    const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);
    
    logger.log(`📊 BATCH: Will process ${totalBatches} batches of ${BATCH_SIZE} chunks each`);
    
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const batch = chunks.slice(i, i + BATCH_SIZE);
      
      logger.log(`🔄 BATCH ${batchNum}/${totalBatches}: Starting`, {
        batchSize: batch.length,
        startIndex: i,
      });
      
      logMemoryUsage(`Before batch ${batchNum}`);
      
      // Generate embeddings for this batch
      const batchWithEmbeddings: Array<DocumentChunk & { embedding: number[] }> = [];
      
      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j];
        logger.log(`  📝 Generating embedding ${j + 1}/${batch.length} in batch ${batchNum}`);
        try {
          const result = await generateEmbedding(chunk.content);
          batchWithEmbeddings.push({
            ...chunk,
            embedding: result.embedding,
            tokenCount: result.tokenCount,
          });
          logger.log(`  ✅ Embedding ${j + 1}/${batch.length} generated`);
          
          // Small delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          logger.error(`  ❌ Embedding generation error for chunk ${j + 1}`, { error, chunkIndex: chunk.chunkIndex });
          throw error;
        }
      }
      
      logger.log(`💾 BATCH ${batchNum}/${totalBatches}: Preparing to store ${batchWithEmbeddings.length} chunks`);
      
      // Store this batch immediately
      const documentsToInsert = batchWithEmbeddings.map((chunk) => ({
        knowledge_base_id: item.knowledge_base_id,
        knowledge_base_item_id: item.id,
        content: chunk.content,
        embedding: JSON.stringify(chunk.embedding),
        chunk_index: chunk.chunkIndex,
        chunk_total: chunk.chunkTotal,
        token_count: chunk.tokenCount,
        metadata: {},
      }));
      
      logger.log(`💾 BATCH ${batchNum}/${totalBatches}: Inserting into database`);
      const { error: insertError } = await supabase
        .from("knowledge_base_documents")
        .insert(documentsToInsert);
      
      if (insertError) {
        logger.error(`❌ BATCH ${batchNum}: Database insertion error`, { error: insertError });
        throw new Error(`Database error: ${insertError.message}`);
      }
      
      totalProcessed += batchWithEmbeddings.length;
      
      logger.log(`✅ BATCH ${batchNum}/${totalBatches}: Stored successfully`, {
        chunksInBatch: batchWithEmbeddings.length,
        totalProcessed,
        remainingBatches: totalBatches - batchNum,
      });
      
      // Explicitly clear batch arrays to help GC
      batchWithEmbeddings.length = 0;
      documentsToInsert.length = 0;
      
      logMemoryUsage(`After batch ${batchNum}`);
      
      // Hint to GC (only works if node is run with --expose-gc)
      if (global.gc) {
        global.gc();
      }
    }
    
    logger.log("🎉 BATCH: All batches processed successfully", { 
      totalChunks: totalProcessed,
      totalBatches,
    });

    return totalProcessed;
  } catch (error) {
    const errorMsg = error instanceof Error 
      ? error.message 
      : "Failed to generate embeddings";
    logger.error("❌ BATCH: Embedding generation error", { error });
    throw new Error(errorMsg);
  }
}


/**
 * Main task: Process a knowledge base item
 * Orchestrates the entire processing pipeline with memory optimization
 */
export const processItem = schemaTask({
  id: "process-item",
  schema: z.object({
    knowledgeBaseItemId: z.string(),
  }),
  machine: "medium-2x",
  queue: {
    concurrencyLimit: 2,
  },
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
    factor: 2,
    randomize: true,
    // Retry on larger machine if OOM occurs
    outOfMemory: {
      machine: "large-2x",
    },
  },
  run: async (payload: { knowledgeBaseItemId: string }, { ctx }) => {
    logger.log("🚀 TASK START: Processing knowledge base item", { payload, ctx });
    logMemoryUsage("Task start");

    const supabase = createSupabaseClient();
    logger.log("✅ Supabase client created");
    
    let text: string | null = null;
    
    try {
      // Fetch the item
      logger.log("📥 Fetching knowledge base item from database");
      const item = await fetchKnowledgeBaseItem(supabase, payload.knowledgeBaseItemId);
      
      logger.log("✅ Found knowledge base item", { 
        id: item.id, 
        type: item.type, 
        name: item.name,
        status: item.status,
        chunkSize: item.chunk_size,
        chunkOverlap: item.chunk_overlap,
        url: item.url,
      });

      // Update status to processing
      logger.log("📝 Updating status to processing");
      await updateItemStatus(supabase, item.id, "processing");
      logger.log("✅ Status updated to processing");

      // Extract text from item
      logger.log("🔍 Starting text extraction from item");
      text = await extractTextFromItem(item);
      logger.log("✅ Text extraction complete", {
        textLength: text.length,
      });
      
      logMemoryUsage("After text extraction");

      // Generate embeddings and store in batches (all in one function to prevent holding all in memory)
      logger.log("🧠 Starting batched embedding generation and storage");
      const chunksCreated = await generateAndStoreEmbeddingsBatched(
        supabase,
        item,
        text,
        item.chunk_size || 512,
        item.chunk_overlap || 50
      );
      logger.log("✅ Batched embedding generation complete", { chunksCreated });

      // Explicitly clear text to help GC
      text = null;
      
      logMemoryUsage("After embedding generation and storage");

      // Update status to indexed
      logger.log("📝 Updating status to indexed");
      await updateItemStatus(supabase, item.id, "indexed");
      logger.log("✅ Status updated to indexed");

      logger.log("🎉 Processing completed successfully", { 
        itemId: item.id,
        chunksCreated 
      });

      logMemoryUsage("Task end");

      return {
        success: true,
        itemId: item.id,
        type: item.type,
        chunksCreated,
      };

    } catch (processingError) {
      logger.error("❌ ERROR processing item", { 
        error: processingError,
        errorMessage: processingError instanceof Error ? processingError.message : "Unknown",
        errorStack: processingError instanceof Error ? processingError.stack : undefined,
      });
      
      // Update status to failed with detailed error
      const errorMessage = processingError instanceof Error 
        ? processingError.message 
        : "Unknown error during processing";
      
      logger.log("📝 Fetching item to update error status");
      const item = await fetchKnowledgeBaseItem(supabase, payload.knowledgeBaseItemId);
      logger.log("📝 Updating status to failed");
      await updateItemStatus(supabase, item.id, "failed", errorMessage);
      logger.log("✅ Status updated to failed");

      throw processingError;
    } finally {
      logger.log("🧹 Starting cleanup");
      // Ensure cleanup
      text = null;
      
      // Hint to GC
      if (global.gc) {
        global.gc();
      }
      
      logMemoryUsage("Task cleanup complete");
      logger.log("✅ Cleanup complete");
    }
  },
});


