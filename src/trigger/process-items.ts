import { logger, schemaTask } from "@trigger.dev/sdk/v3";
import z from "zod";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { KnowledgeBaseItem, DocumentChunk } from "@/types/knowledge-base";
import { processTextWithEmbeddings, extractTextFromHTML } from "@/lib/embeddings/processor";

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
 * Using direct API calls instead of SDK to reduce memory overhead
 */
async function fetchTextFromURLWithFirecrawl(url: string): Promise<string> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error("Firecrawl API key not configured");
  }

  logger.log("Fetching URL with Firecrawl", { url });

  const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: url,
      formats: ["markdown"],
      maxAge: 0,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Firecrawl API error ${response.status}: ${errorText}`);
  }

  const result = await response.json();

  if (!result.success || !result.data?.markdown) {
    throw new Error("No content extracted from URL via Firecrawl");
  }

  logger.log("Successfully fetched URL", { 
    url, 
    textLength: result.data.markdown.length 
  });

  return result.data.markdown;
}

/**
 * Extract text content based on item type
 */
async function extractTextFromItem(item: KnowledgeBaseItem): Promise<string> {
  if (item.type === "url" && item.url) {
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
    return item.text_content;
  } 
  
  if (item.type === "file" && item.file_location) {
    throw new Error("File processing is not yet implemented");
  }
  
  throw new Error(`Unsupported item type: ${item.type}`);
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

  const documents = chunks.map((chunk) => ({
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

  logger.log("Stored chunks in database", { count: documents.length });

  return documents.length;
}


/**
 * Main task: Process a knowledge base item
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
    outOfMemory: {
      machine: "large-2x",
    },
  },
  run: async (payload: { knowledgeBaseItemId: string }) => {
    const supabase = createSupabaseClient();
    
    // Fetch the item
    const item = await fetchKnowledgeBaseItem(supabase, payload.knowledgeBaseItemId);
    logger.log("Processing knowledge base item", { 
      id: item.id, 
      type: item.type, 
      name: item.name,
    });

    try {
      // Update status to processing
      await updateItemStatus(supabase, item.id, "processing");

      // Extract text from item
      const text = await extractTextFromItem(item);
      logger.log("Text extracted", { textLength: text.length });

      // Generate embeddings
      const chunksWithEmbeddings = await processTextWithEmbeddings(
        text,
        item.chunk_size || 512,
        item.chunk_overlap || 50
      );
      logger.log("Embeddings generated", { chunkCount: chunksWithEmbeddings.length });

      // Store chunks in database
      const chunksCreated = await storeDocumentChunks(
        supabase,
        item,
        chunksWithEmbeddings
      );

      // Update status to indexed
      await updateItemStatus(supabase, item.id, "indexed");

      logger.log("Processing completed successfully", { 
        itemId: item.id,
        chunksCreated 
      });

      return {
        success: true,
        itemId: item.id,
        type: item.type,
        chunksCreated,
      };

    } catch (processingError) {
      logger.error("Error processing item", { error: processingError });
      
      const errorMessage = processingError instanceof Error 
        ? processingError.message 
        : "Unknown error during processing";
      
      await updateItemStatus(supabase, item.id, "failed", errorMessage);

      throw processingError;
    }
  },
});


