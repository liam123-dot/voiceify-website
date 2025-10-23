import { logger, wait } from "@trigger.dev/sdk/v3";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { KnowledgeBaseItem, DocumentChunk, RightmoveAgentConfig } from "@/types/knowledge-base";
import { processTextWithEmbeddings } from "@/lib/embeddings/processor";
import { ApifyClient } from "apify-client";
import axios from "axios";
import type { ProcessResult } from "./url";

/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║              RIGHTMOVE AGENT PROCESSOR WITH APIFY                      ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 * 
 * This processor handles Rightmove Agent items by:
 * 1. Extracting rent and sale URLs from parent item metadata
 * 2. Using Apify to scrape all property listings from both URLs
 * 3. Deleting existing child properties (clean slate approach)
 * 4. Creating new child items for each property with:
 *    - Full JSON stored in metadata
 *    - Concise text embedded for search (title, address, description, etc.)
 *    - Embeddings stored in knowledge_base_documents
 */

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
 * Optionally includes metadata (e.g., full property data for rightmove_property)
 */
async function storeDocumentChunks(
  supabase: SupabaseClient,
  item: KnowledgeBaseItem,
  chunks: Array<DocumentChunk & { embedding: number[] }>,
  chunkMetadata?: Record<string, unknown>
): Promise<number> {
  if (chunks.length === 0) {
    return 0;
  }

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
      metadata: chunkMetadata || {}, // Include property metadata if provided
    }));

    const { error: insertError } = await supabase
      .from("knowledge_base_documents")
      .insert(documents);

    if (insertError) {
      throw new Error(`Database error: ${insertError.message}`);
    }

    storedCount += documents.length;
  }

  return storedCount;
}

/**
 * Delete all existing child properties for a parent agent
 * Uses CASCADE delete via parent_item_id foreign key
 */
async function deleteExistingChildProperties(
  supabase: SupabaseClient,
  parentItemId: string
): Promise<number> {
  logger.info("🗑️  Deleting existing child properties", { parentItemId });

  const { data: existingChildren, error: fetchError } = await supabase
    .from("knowledge_base_items")
    .select("id")
    .eq("parent_item_id", parentItemId);

  if (fetchError) {
    throw new Error(`Error fetching existing children: ${fetchError.message}`);
  }

  if (!existingChildren || existingChildren.length === 0) {
    logger.info("  ↳ No existing children to delete");
    return 0;
  }

  const { error: deleteError } = await supabase
    .from("knowledge_base_items")
    .delete()
    .eq("parent_item_id", parentItemId);

  if (deleteError) {
    throw new Error(`Error deleting existing children: ${deleteError.message}`);
  }

  logger.info("✅ Deleted existing child properties", { count: existingChildren.length });
  return existingChildren.length;
}

/**
 * Fetch properties from Apify using Rightmove scraper
 */
async function fetchPropertiesFromApify(
  rentUrl?: string,
  saleUrl?: string
): Promise<Record<string, unknown>[]> {
  // Build startUrls array from provided URLs
  const startUrls: string[] = [];
  if (rentUrl) startUrls.push(rentUrl);
  if (saleUrl) startUrls.push(saleUrl);

  if (startUrls.length === 0) {
    throw new Error("At least one URL (rentUrl or saleUrl) is required");
  }

  logger.info("🔍 Fetching properties from Apify", { 
    rentUrl: rentUrl || 'not provided',
    saleUrl: saleUrl || 'not provided',
    urlCount: startUrls.length
  });

  const apiToken = process.env.APIFY_API_KEY;
  if (!apiToken) {
    throw new Error("APIFY_API_KEY environment variable not configured");
  }

  const client = new ApifyClient({ token: apiToken });

  const input = {
    startUrls,
    customMapFunction: "(object) => { return {...object} }",
    extendOutputFunction: "($) => { return {} }",
    proxy: {
      useApifyProxy: true,
    },
  };

  logger.info("  ↳ Starting Apify actor run...");
  const run = await client.actor("LwR6JRNl4khcKXIWo").call(input);

  logger.info("  ↳ Fetching complete dataset...");
  
  // Fetch ALL items from the dataset by iterating through all pages
  const allItems: unknown[] = [];
  let offset = 0;
  const limit = 1000; // Maximum items per request
  
  while (true) {
    const { items, count, total } = await client.dataset(run.defaultDatasetId).listItems({
      offset,
      limit,
    });
    
    allItems.push(...items);
    
    logger.info(`  ↳ Fetched batch: ${items.length} items (${allItems.length}/${total} total)`);
    
    // If we've fetched all items, break
    if (allItems.length >= total || items.length === 0) {
      break;
    }
    
    offset += items.length;
  }

  logger.info("✅ Complete dataset fetched from Apify", { totalItems: allItems.length });

  return allItems as Record<string, unknown>[];
}

/**
 * Generate concise text for embedding from property data
 * Only includes searchable fields, full data stored in metadata
 */
function generatePropertyText(property: Record<string, unknown>): string {
  const parts: string[] = [];

  // Title
  if (property.title && typeof property.title === 'string') {
    parts.push(property.title);
  }

  // Address
  if (property.address && typeof property.address === 'string') {
    parts.push(property.address);
  }

  // Description
  if (property.description && typeof property.description === 'string') {
    // Limit description to first 500 chars to keep embedding focused
    const desc = property.description.substring(0, 500);
    parts.push(desc);
  }

  // Beds and baths
  const bedInfo: string[] = [];
  if (property.beds !== null && property.beds !== undefined) {
    bedInfo.push(`${property.beds} bed`);
  }
  if (property.baths !== null && property.baths !== undefined) {
    bedInfo.push(`${property.baths} bath`);
  }
  if (bedInfo.length > 0) {
    parts.push(bedInfo.join(', '));
  }

  // Property type
  if (property.propertyType && typeof property.propertyType === 'string') {
    parts.push(property.propertyType);
  }
  if (property.propertySubType && typeof property.propertySubType === 'string') {
    parts.push(property.propertySubType);
  }

  // Price
  if (property.primaryPrice && typeof property.primaryPrice === 'string') {
    parts.push(property.primaryPrice);
  }

  // Features (first 5 only)
  if (Array.isArray(property.features) && property.features.length > 0) {
    const topFeatures = property.features.slice(0, 5);
    parts.push(`Features: ${topFeatures.join(', ')}`);
  }

  return parts.join('\n');
}

/**
 * Create a child property item in the database
 */
async function createPropertyItem(
  supabase: SupabaseClient,
  parentItem: KnowledgeBaseItem,
  property: Record<string, unknown>,
  propertyIndex: number,
  totalProperties: number
): Promise<{ itemId: string; chunksCreated: number }> {
  const propertyId = property.id as string;
  const propertyUrl = property.url as string;
  const propertyTitle = property.title as string || `Property ${propertyId}`;

  logger.info(`  ↳ Processing property ${propertyIndex + 1}/${totalProperties}`, {
    propertyId,
    title: propertyTitle.substring(0, 50),
  });

  // Generate concise text for embedding
  const embeddingText = generatePropertyText(property);

  // Create the child item
  const { data: childItem, error: insertError } = await supabase
    .from("knowledge_base_items")
    .insert({
      knowledge_base_id: parentItem.knowledge_base_id,
      parent_item_id: parentItem.id,
      name: propertyTitle,
      type: "rightmove_property",
      url: propertyUrl,
      external_id: propertyId,
      status: "processing",
      chunk_size: parentItem.chunk_size || 512,
      chunk_overlap: parentItem.chunk_overlap || 50,
      metadata: property, // Store full JSON in metadata
    })
    .select()
    .single();

  if (insertError || !childItem) {
    throw new Error(`Failed to create child item: ${insertError?.message || "Unknown error"}`);
  }

  // Generate embeddings for the concise text
  const chunksWithEmbeddings = await generateEmbeddingsWithRetry(
    embeddingText,
    parentItem.chunk_size || 512,
    parentItem.chunk_overlap || 50
  );

  // Store chunks with property metadata
  const chunksCreated = await storeDocumentChunks(
    supabase,
    childItem as KnowledgeBaseItem,
    chunksWithEmbeddings,
    property // Pass the full property data as metadata for each chunk
  );

  // Update status to indexed
  await supabase
    .from("knowledge_base_items")
    .update({
      status: "indexed",
      last_synced_at: new Date().toISOString(),
    })
    .eq("id", childItem.id);

  return { itemId: childItem.id, chunksCreated };
}

/**
 * Process a Rightmove Agent knowledge base item
 */
export async function processRightmoveAgent(
  supabase: SupabaseClient,
  item: KnowledgeBaseItem
): Promise<ProcessResult> {
  const startTime = Date.now();
  
  logger.info("🏠 Processing Rightmove Agent item", { 
    itemId: item.id,
    name: item.name
  });

  // Extract configuration from metadata
  const config = item.metadata as RightmoveAgentConfig | undefined;
  if (!config?.rentUrl && !config?.saleUrl) {
    throw new Error("Rightmove Agent requires at least one URL (rentUrl or saleUrl) in metadata");
  }

  logger.info("📋 Agent configuration", {
    rentUrl: config.rentUrl || 'not provided',
    saleUrl: config.saleUrl || 'not provided',
    syncSchedule: config.syncSchedule,
  });

  // Delete existing child properties
  const deletedCount = await deleteExistingChildProperties(supabase, item.id);

  // Fetch properties from Apify
  const properties = await fetchPropertiesFromApify(config.rentUrl, config.saleUrl);

  if (properties.length === 0) {
    logger.warn("⚠️  No properties found from Apify");
    const durationSec = (Date.now() - startTime) / 1000;
    return {
      success: true,
      itemId: item.id,
      type: item.type,
      chunksCreated: 0,
      durationSec,
    };
  }

  // Process each property
  logger.info("🔄 Processing properties", { 
    total: properties.length,
    deletedOld: deletedCount 
  });

  let totalChunksCreated = 0;
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < properties.length; i++) {
    try {
      const result = await createPropertyItem(
        supabase,
        item,
        properties[i],
        i,
        properties.length
      );
      totalChunksCreated += result.chunksCreated;
      successCount++;
    } catch (error) {
      failureCount++;
      logger.error("❌ Failed to process property", {
        propertyIndex: i + 1,
        propertyId: properties[i].id,
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue processing other properties
    }
  }

  const durationSec = (Date.now() - startTime) / 1000;
  
  logger.info("🎉 Rightmove Agent processing completed", {
    itemId: item.id,
    propertiesProcessed: successCount,
    propertiesFailed: failureCount,
    totalProperties: properties.length,
    totalChunksCreated,
    durationSec: `${durationSec.toFixed(2)}s`,
  });

  return {
    success: true,
    itemId: item.id,
    type: item.type,
    chunksCreated: totalChunksCreated,
    durationSec,
  };
}

