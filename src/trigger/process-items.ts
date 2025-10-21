import { logger, schemaTask } from "@trigger.dev/sdk/v3";
import z from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClientNoCookies } from "@/lib/supabase/server";
import type { KnowledgeBaseItem, DocumentChunk } from "@/types/knowledge-base";
import { processTextWithEmbeddings, extractTextFromHTML } from "@/lib/embeddings/processor";
import FirecrawlApp from "@mendable/firecrawl-js";

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

  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    logger.error("FIRECRAWL_API_KEY not configured");
    throw new Error("Firecrawl API key not configured");
  }

  try {
    const firecrawl = new FirecrawlApp({ apiKey });

    logger.log("Starting Firecrawl scrape", { url });

    // Scrape the URL with Firecrawl
    const scrapeResult = await firecrawl.scrapeUrl(url, {
      formats: ["markdown", "html"],
      onlyMainContent: true, // Extract only the main content, removing headers, footers, etc.
      waitFor: 1000, // Wait for JavaScript to load (in milliseconds)
    });

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
 * Generate embeddings for text content
 */
async function generateEmbeddingsForText(
  text: string,
  chunkSize: number,
  chunkOverlap: number
): Promise<Array<DocumentChunk & { embedding: number[] }>> {
  if (!text || text.trim().length === 0) {
    throw new Error("No text content to process");
  }

  logger.log("Starting text chunking and embedding generation", {
    textLength: text.length,
    chunkSize,
    chunkOverlap
  });

  try {
    const chunks = await processTextWithEmbeddings(text, chunkSize, chunkOverlap);
    
    logger.log("Generated embeddings for chunks", { 
      chunkCount: chunks.length 
    });

    return chunks;
  } catch (error) {
    const errorMsg = error instanceof Error 
      ? error.message 
      : "Failed to generate embeddings";
    logger.error("Embedding generation error", { error });
    throw new Error(errorMsg);
  }
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
    logger.log("No chunks to store");
    return 0;
  }

  logger.log("Storing chunks in database", { 
    chunkCount: chunks.length 
  });

  try {
    // Prepare documents for batch insert
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

    // Batch insert all documents
    const { error: insertError } = await supabase
      .from("knowledge_base_documents")
      .insert(documents);

    if (insertError) {
      logger.error("Database insertion error", { error: insertError });
      throw new Error(`Database error: ${insertError.message}`);
    }

    logger.log("Successfully stored chunks in database", { 
      chunksCreated: documents.length 
    });

    return documents.length;
  } catch (error) {
    const errorMsg = error instanceof Error 
      ? `Database error: ${error.message}` 
      : "Failed to store chunks in database";
    logger.error("Database operation error", { error });
    throw new Error(errorMsg);
  }
}

/**
 * Main task: Process a knowledge base item
 * Orchestrates the entire processing pipeline
 */
export const processItem = schemaTask({
  id: "process-item",
  schema: z.object({
    knowledgeBaseItemId: z.string(),
  }),
  queue: {
    concurrencyLimit: 2,
  },
  run: async (payload: { knowledgeBaseItemId: string }, { ctx }) => {
    logger.log("Processing knowledge base item", { payload, ctx });

    const supabase = await createServiceClientNoCookies();
    
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

    try {
      // Update status to processing
      await updateItemStatus(supabase, item.id, "processing");
      logger.log("Updated status to processing");

      // Extract text from item
      const text = await extractTextFromItem(item);

      // Generate embeddings
      const chunksWithEmbeddings = await generateEmbeddingsForText(
        text,
        item.chunk_size || 512,
        item.chunk_overlap || 50
      );

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
      
      // Update status to failed with detailed error
      const errorMessage = processingError instanceof Error 
        ? processingError.message 
        : "Unknown error during processing";
      
      await updateItemStatus(supabase, item.id, "failed", errorMessage);

      throw processingError;
    }
  },
});


