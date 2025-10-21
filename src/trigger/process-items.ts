import { logger, schemaTask, tasks, task } from "@trigger.dev/sdk/v3";
import z from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClientNoCookies } from "@/lib/supabase/server";
import type { KnowledgeBaseItem, DocumentChunk } from "@/types/knowledge-base";
import { extractTextFromHTML } from "@/lib/embeddings/processor";
import FirecrawlApp from "@mendable/firecrawl-js";

import { ResourceMonitor } from "./resource-monitor";

// Initialize Firecrawl client as singleton to prevent memory leaks
let firecrawlClient: FirecrawlApp | null = null;

function getFirecrawlClient(): FirecrawlApp {
  if (!firecrawlClient) {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      throw new Error("Firecrawl API key not configured");
    }
    firecrawlClient = new FirecrawlApp({ apiKey });
  }
  return firecrawlClient;
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
 * Fetch and extract text from a URL using Firecrawl
 * Firecrawl provides better scraping with JavaScript rendering and cleaner content extraction
 */
async function fetchTextFromURLWithFirecrawl(url: string): Promise<string> {
  logger.log("Fetching URL with Firecrawl", { url });
  logMemoryUsage("Before Firecrawl scrape");

  try {
    const firecrawl = getFirecrawlClient();

    logger.log("Starting Firecrawl scrape", { url });

    // Scrape the URL with Firecrawl
    const scrapeResult = await firecrawl.scrapeUrl(url);

    if (!scrapeResult.success) {
      throw new Error("Firecrawl scrape failed");
    }

    // Prefer markdown content, fall back to HTML extraction
    let text = "";
    
    if (scrapeResult.markdown && scrapeResult.markdown.trim().length > 0) {
      text = scrapeResult.markdown;
      logger.log("Using markdown content from Firecrawl", {
        textLength: text.length,
      });
    } else if (scrapeResult.html && scrapeResult.html.trim().length > 0) {
      text = extractTextFromHTML(scrapeResult.html);
      logger.log("Using HTML content from Firecrawl", {
        textLength: text.length,
      });
    }

    if (!text || text.trim().length === 0) {
      throw new Error("No text content extracted from URL via Firecrawl");
    }

    logger.log("Successfully extracted text from URL using Firecrawl", {
      textLength: text.length,
      url,
      usedMarkdown: !!scrapeResult.markdown,
    });

    logMemoryUsage("After Firecrawl scrape");

    return text;
  } catch (error) {
    const errorMsg = error instanceof Error 
      ? error.message 
      : "Unknown error";
    logger.error("Firecrawl fetch error", { error, url });
    throw new Error(`Failed to fetch URL with Firecrawl: ${errorMsg}`);
  }
}

/**
 * Extract text content based on item type
 */
async function extractTextFromItem(item: KnowledgeBaseItem): Promise<string> {
  if (item.type === "url" && item.url) {
    // Try Firecrawl first, fall back to basic fetch if it fails
    try {
      return await fetchTextFromURLWithFirecrawl(item.url);
    } catch (firecrawlError) {
      logger.warn("Firecrawl failed, falling back to basic fetch", { 
        error: firecrawlError,
        url: item.url 
      });
      return await fetchTextFromURL(item.url);
    }
  } 
  
  if (item.type === "text" && item.text_content) {
    logger.log("Using text content from item", { 
      textLength: item.text_content.length 
    });
    return item.text_content;
  } 
  
  if (item.type === "file" && item.file_location) {
    logger.log("File processing not yet implemented", { 
      fileLocation: item.file_location,
      fileType: item.file_type 
    });
    throw new Error("File processing is not yet implemented. Please use text or URL items for now.");
  }
  
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

  logger.log("Starting batched text chunking and embedding generation", {
    textLength: text.length,
    chunkSize,
    chunkOverlap
  });
  logMemoryUsage("Before chunking");

  try {
    // Import chunking and embedding functions
    const { chunkText, generateEmbedding } = await import("@/lib/embeddings/processor");
    
    // First, chunk the text
    const chunks = await chunkText(text, chunkSize, chunkOverlap);
    logger.log("Text chunked", { chunkCount: chunks.length });
    
    // Process and store in batches to avoid memory buildup
    const BATCH_SIZE = 10;
    let totalProcessed = 0;
    
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      logger.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)}`, {
        batchSize: batch.length,
      });
      
      logMemoryUsage(`Before batch ${Math.floor(i / BATCH_SIZE) + 1}`);
      
      // Generate embeddings for this batch
      const batchWithEmbeddings: Array<DocumentChunk & { embedding: number[] }> = [];
      
      for (const chunk of batch) {
        try {
          const result = await generateEmbedding(chunk.content);
          batchWithEmbeddings.push({
            ...chunk,
            embedding: result.embedding,
            tokenCount: result.tokenCount,
          });
          
          // Small delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          logger.error("Embedding generation error for chunk", { error, chunkIndex: chunk.chunkIndex });
          throw error;
        }
      }
      
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
      
      const { error: insertError } = await supabase
        .from("knowledge_base_documents")
        .insert(documentsToInsert);
      
      if (insertError) {
        logger.error("Database insertion error", { error: insertError });
        throw new Error(`Database error: ${insertError.message}`);
      }
      
      totalProcessed += batchWithEmbeddings.length;
      
      logger.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1} stored successfully`, {
        chunksInBatch: batchWithEmbeddings.length,
        totalProcessed,
      });
      
      // Explicitly clear batch arrays to help GC
      batchWithEmbeddings.length = 0;
      documentsToInsert.length = 0;
      
      logMemoryUsage(`After batch ${Math.floor(i / BATCH_SIZE) + 1}`);
      
      // Hint to GC (only works if node is run with --expose-gc)
      if (global.gc) {
        global.gc();
      }
    }
    
    logger.log("All batches processed successfully", { 
      totalChunks: totalProcessed 
    });

    return totalProcessed;
  } catch (error) {
    const errorMsg = error instanceof Error 
      ? error.message 
      : "Failed to generate embeddings";
    logger.error("Embedding generation error", { error });
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
    logger.log("Processing knowledge base item", { payload, ctx });
    logMemoryUsage("Task start");

    const supabase = await createServiceClientNoCookies();
    let text: string | null = null;
    
    try {
      // Fetch the item
      const item = await fetchKnowledgeBaseItem(supabase, payload.knowledgeBaseItemId);
      
      logger.log("Found knowledge base item", { 
        id: item.id, 
        type: item.type, 
        name: item.name,
        status: item.status,
        chunkSize: item.chunk_size,
        chunkOverlap: item.chunk_overlap
      });

      // Update status to processing
      await updateItemStatus(supabase, item.id, "processing");
      logger.log("Updated status to processing");

      // Extract text from item
      text = await extractTextFromItem(item);
      logMemoryUsage("After text extraction");

      logger.log("Text extracted successfully", {
        textLength: text.length,
      });

      // Generate embeddings and store in batches (all in one function to prevent holding all in memory)
      const chunksCreated = await generateAndStoreEmbeddingsBatched(
        supabase,
        item,
        text,
        item.chunk_size || 512,
        item.chunk_overlap || 50
      );

      // Explicitly clear text to help GC
      text = null;
      
      logMemoryUsage("After embedding generation and storage");

      // Update status to indexed
      await updateItemStatus(supabase, item.id, "indexed");

      logger.log("Processing completed successfully", { 
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
      logger.error("Error processing item", { error: processingError });
      
      // Update status to failed with detailed error
      const errorMessage = processingError instanceof Error 
        ? processingError.message 
        : "Unknown error during processing";
      
      const item = await fetchKnowledgeBaseItem(supabase, payload.knowledgeBaseItemId);
      await updateItemStatus(supabase, item.id, "failed", errorMessage);

      throw processingError;
    } finally {
      // Ensure cleanup
      text = null;
      
      // Hint to GC
      if (global.gc) {
        global.gc();
      }
      
      logMemoryUsage("Task cleanup complete");
    }
  },
});


