import { logger, schemaTask } from "@trigger.dev/sdk/v3";
import z from "zod";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { KnowledgeBaseItem } from "@/types/knowledge-base";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║          AI-POWERED KEYWORD EXTRACTION FOR STT ACCURACY                ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 * 
 * This task analyzes knowledge base items to extract domain-specific keywords
 * that improve speech-to-text transcription accuracy.
 * 
 * ARCHITECTURE:
 * =============
 * - Processes one knowledge_base_item at a time
 * - Fetches all associated knowledge_base_documents
 * - Analyzes both content and metadata using Gemini 2.5 Flash
 * - Stores extracted keywords at the item level
 * - Status tracking prevents duplicates and ensures fault tolerance
 * 
 * KEYWORD TYPES:
 * ==============
 * - Proper nouns (company names, people, locations, brands, street names)
 * - Specialized/technical terminology
 * - Words likely to be misheard by STT
 * - Uncommon words not in general vocabulary
 * 
 * STATUS FLOW:
 * ============
 * null → pending → processing → completed/failed
 * 
 * RETRY STRATEGY:
 * ===============
 * - 5 task-level retries with exponential backoff
 * - Status updates to 'failed' only on final attempt
 * - Impossible to get stuck in 'processing' due to timeout + retry logic
 * 
 * CONFIGURATION:
 * ==============
 * - Machine: small-1x (smallest available)
 * - Queue concurrency: 5 parallel extractions
 * - Retry factor: 2.5x exponential backoff with jitter
 * - Retry range: 2s min → 60s max
 */

/**
 * Create Supabase client for Trigger.dev tasks
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
 * Update item's keyword extraction status
 */
async function updateKeywordStatus(
  supabase: SupabaseClient,
  itemId: string,
  status: "pending" | "processing" | "completed" | "failed",
  keywords?: string[]
): Promise<void> {
  const updates: {
    keyword_extraction_status: string;
    extracted_keywords?: string[];
  } = {
    keyword_extraction_status: status,
  };

  if (keywords) {
    updates.extracted_keywords = keywords;
  }

  const { error } = await supabase
    .from("knowledge_base_items")
    .update(updates)
    .eq("id", itemId);

  if (error) {
    logger.error("Failed to update keyword extraction status", { error, itemId, status });
    throw error;
  }

  logger.info(`✅ Updated keyword extraction status to: ${status}`, { itemId });
}

/**
 * Fetch knowledge base item by ID
 */
async function fetchKnowledgeBaseItem(
  supabase: SupabaseClient,
  itemId: string
): Promise<KnowledgeBaseItem> {
  const { data, error } = await supabase
    .from("knowledge_base_items")
    .select("*")
    .eq("id", itemId)
    .single();

  if (error || !data) {
    throw new Error(`Failed to fetch knowledge base item: ${error?.message || "Not found"}`);
  }

  return data as KnowledgeBaseItem;
}

/**
 * Fetch all document content for a knowledge base item
 */
async function fetchDocumentContent(
  supabase: SupabaseClient,
  itemId: string
): Promise<{ content: string; metadata: Record<string, unknown> | null }[]> {
  const { data, error } = await supabase
    .from("knowledge_base_documents")
    .select("content, metadata")
    .eq("knowledge_base_item_id", itemId);

  if (error) {
    throw new Error(`Failed to fetch documents: ${error.message}`);
  }

  return (data || []) as { content: string; metadata: Record<string, unknown> | null }[];
}

/**
 * Extract keywords using Gemini 2.5 Flash via OpenRouter
 */
async function extractKeywordsWithAI(
  content: string,
  metadata?: Record<string, unknown>
): Promise<string[]> {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY environment variable is not set");
  }

  // Create OpenAI-compatible provider with OpenRouter base URL
  const openrouter = createOpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
  });

  const systemPrompt = `You are analyzing content for speech-to-text keyword extraction.

CRITICAL RULE: If a word exists as a common English dictionary word, DO NOT INCLUDE IT.

Identify SINGLE WORDS that are:
- Proper nouns with uncommon or unique spelling (specific company names, uncommon location names, brand names)
- The distinctive part of street names, ONLY if it's not a dictionary word
- Industry-specific company/brand names

EXCLUDE ENTIRELY:
- Any word in a standard English dictionary
- File extensions (pdf, doc, jpg, png, etc.)
- Common acronyms widely used in everyday language (WIFI, AI, BR, DLR, etc.)
- Status codes or metadata (STC, SOLD, FREEHOLD, etc.)
- Well-known places (London, Oxford, Heathrow, Gatwick, Croydon)
- Famous transport/infrastructure (Thameslink, Bakerloo, DLR)
- Common brand names known internationally (Waitrose)
- Postcodes or alphanumeric codes
- Generic suffixes (Street, Road, Avenue, etc.)
- Duplicates in different cases (keep only one version)

INCLUDE ONLY:
- Uncommon proper nouns unlikely to be in dictionaries (e.g., "Maidenhead", "Wokingham", "Taplow")
- Specialized company/brand names specific to the industry (e.g., "Rightmove", "Zoopla", "Vebra")
- Unusual location or street name components that STT would genuinely struggle with

Return ONLY a JSON array of unique single-word keywords, no explanations. Use consistent casing.

Example: ["Rightmove", "Zoopla", "Maidenhead", "Wokingham", "Vebra", "Taplow"]
`;

  let metadataText = "";
  if (metadata && Object.keys(metadata).length > 0) {
    metadataText = `\n\nMetadata:\n${JSON.stringify(metadata, null, 2)}`;
  }

  const userPrompt = `Analyze this content and extract STT keywords:

${content}${metadataText}

Return only the JSON array.`;

  logger.info("🤖 Calling Gemini 2.5 Flash for keyword extraction", {
    contentLength: content.length,
    hasMetadata: !!metadata,
  });

  const { text } = await generateText({
    model: openrouter("openai/gpt-5-nano"),
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
  });

  logger.info("✅ Received AI response", { responseLength: text.length });

  // Parse JSON array from response
  try {
    // Try to extract JSON array from markdown code blocks if present
    const jsonMatch = text.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
    const jsonText = jsonMatch ? jsonMatch[1] : text.trim();
    
    const keywords = JSON.parse(jsonText);
    
    if (!Array.isArray(keywords)) {
      throw new Error("Response is not an array");
    }

    // Filter to only string values and remove duplicates
    const uniqueKeywords = Array.from(new Set(keywords.filter((k) => typeof k === "string")));
    
    logger.info(`✅ Extracted ${uniqueKeywords.length} keywords`, {
      keywords: uniqueKeywords.slice(0, 10), // Log first 10 for debugging
    });

    return uniqueKeywords;
  } catch (parseError) {
    logger.error("Failed to parse AI response as JSON array", {
      parseError,
      response: text.slice(0, 500),
    });
    throw new Error(`Failed to parse keywords from AI response: ${parseError}`);
  }
}

/**
 * Main task: Extract keywords for a knowledge base item
 */
export const extractKbItemKeywords = schemaTask({
  id: "extract-kb-item-keywords",
  schema: z.object({
    knowledgeBaseItemId: z.string().uuid(),
  }),
  machine: {
    preset: "small-1x", // Smallest machine available
  },
  queue: {
    concurrencyLimit: 5, // Process up to 5 extractions in parallel
  },
  retry: {
    maxAttempts: 5,
    factor: 2.5,
    minTimeoutInMs: 2_000,
    maxTimeoutInMs: 60_000,
    randomize: true,
  },
  run: async (payload, { ctx }) => {
    const { knowledgeBaseItemId } = payload;

    logger.info("🚀 Starting keyword extraction", {
      itemId: knowledgeBaseItemId,
      attemptNumber: ctx.attempt.number,
    });

    const supabase = createSupabaseClient();
    const isFinalAttempt = ctx.attempt.number === 5;

    try {
      // Fetch the item
      const item = await fetchKnowledgeBaseItem(supabase, knowledgeBaseItemId);
      
      logger.info(`📄 Processing item: ${item.name}`, {
        type: item.type,
        currentStatus: item.keyword_extraction_status,
      });

      // Update status to processing
      await updateKeywordStatus(supabase, knowledgeBaseItemId, "processing");

      // Fetch all documents
      const documents = await fetchDocumentContent(supabase, knowledgeBaseItemId);
      
      if (documents.length === 0) {
        logger.warn("⚠️ No documents found for item, using item text_content if available");
      }

      // Combine all content
      const combinedContent = documents.map((doc) => doc.content).join("\n\n");
      const contentToAnalyze = combinedContent || item.text_content || "";

      if (!contentToAnalyze) {
        logger.warn("⚠️ No content available to extract keywords from");
        await updateKeywordStatus(supabase, knowledgeBaseItemId, "completed", []);
        return {
          success: true,
          itemId: knowledgeBaseItemId,
          keywords: [],
          message: "No content available",
        };
      }

      // Combine metadata from all documents
      const allMetadata = documents
        .map((doc) => doc.metadata)
        .filter((m): m is Record<string, unknown> => m !== null && Object.keys(m).length > 0);

      const combinedMetadata =
        allMetadata.length > 0 ? Object.assign({}, ...allMetadata) : item.metadata || undefined;

      logger.info("📊 Content gathered", {
        contentLength: contentToAnalyze.length,
        documentCount: documents.length,
        hasMetadata: !!combinedMetadata,
      });

      // Extract keywords using AI
      const keywords = await extractKeywordsWithAI(contentToAnalyze, combinedMetadata);

      // Update item with extracted keywords
      await updateKeywordStatus(supabase, knowledgeBaseItemId, "completed", keywords);

      logger.info("✅ Keyword extraction completed", {
        itemId: knowledgeBaseItemId,
        keywordCount: keywords.length,
      });

      return {
        success: true,
        itemId: knowledgeBaseItemId,
        keywords,
        keywordCount: keywords.length,
      };
    } catch (error) {
      logger.error("❌ Keyword extraction failed", {
        error,
        itemId: knowledgeBaseItemId,
        attemptNumber: ctx.attempt.number,
        isFinalAttempt,
      });

      // Only update to failed on final attempt
      if (isFinalAttempt) {
        try {
          await updateKeywordStatus(supabase, knowledgeBaseItemId, "failed");
        } catch (statusError) {
          logger.error("Failed to update status to failed", { statusError });
        }
      }

      throw error;
    }
  },
});

