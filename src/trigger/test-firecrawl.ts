import { logger, schemaTask } from "@trigger.dev/sdk/v3";
import z from "zod";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { KnowledgeBaseItem, DocumentChunk } from "@/types/knowledge-base";
import { processTextWithEmbeddings } from "@/lib/embeddings/processor";
import Firecrawl from "@mendable/firecrawl-js";

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
 * Fetch and extract text from a URL using Firecrawl
 */
async function fetchTextFromURL(url: string): Promise<string> {
  logger.log("Fetching URL with Firecrawl", { url });

  const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY! });

  const result = await firecrawl.scrapeUrl(url, {
    formats: ["markdown"],
  });

  if (!result.success) {
    throw new Error(result.error || "Failed to scrape URL with Firecrawl");
  }

  if (!result.markdown) {
    throw new Error("No content extracted from URL");
  }

  logger.log("Successfully fetched URL", { 
    textLength: result.markdown.length,
    url 
  });

  return result.markdown;
}

/**
 * Extract text content based on item type
 */
async function extractTextFromItem(item: KnowledgeBaseItem): Promise<string> {
  if (item.type === "url" && item.url) {
    return await fetchTextFromURL(item.url);
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
  id: "test-firecrawl-1",
  schema: z.object({
    knowledgeBaseItemId: z.string(),
  }),
  machine: "medium-2x",
  queue: {
    concurrencyLimit: 2,
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


