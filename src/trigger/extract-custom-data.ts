import { logger, schemaTask } from "@trigger.dev/sdk/v3";
import z from "zod";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { KnowledgeBaseItem } from "@/types/knowledge-base";
import type { ExtractionModel } from "@/types/extractions";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║          CUSTOM DATA EXTRACTION FOR KNOWLEDGE BASE ITEMS               ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 * 
 * This task runs custom AI prompts against knowledge base items to extract
 * structured data based on user-defined requirements.
 * 
 * ARCHITECTURE:
 * =============
 * - Processes one knowledge_base_item at a time
 * - Fetches all associated knowledge_base_documents
 * - Runs custom prompt using specified AI model
 * - Stores extracted data in knowledge_base_item_extractions
 * - Updates parent extraction progress counter
 * 
 * SUPPORTED MODELS:
 * ================
 * - openai/gpt-5-nano: Fast, cheapest
 * - openai/gpt-5-mini: Balanced
 * - google/gemini-2.5-flash: Best reasoning
 * 
 * RETRY STRATEGY:
 * ===============
 * - 3 task-level retries with exponential backoff
 * - Failed items marked as 'failed' in item_extractions table
 * - Parent extraction progress counter updated regardless of success/failure
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
 * Run custom extraction using AI with specified model
 */
async function extractDataWithAI(
  content: string,
  prompt: string,
  model: ExtractionModel,
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

  const systemPrompt = `You are analyzing content for data extraction with absolute focus on CONSISTENCY.

CRITICAL REQUIREMENTS FOR AGGREGATION:
============================================
The extracted values must be consistent and standardized so they can be reliably aggregated.

STRICT RULES:
1. CONSISTENCY IS PARAMOUNT - Identical values must always be formatted exactly the same way
2. Normalize all values to match any provided standard formats or examples
3. If the user prompt specifies exact allowed values, return ONLY those exact values
4. Never create variations - e.g., "New York" and "NY" are not equivalent; pick ONE format
5. Trim whitespace and use consistent capitalization
6. Return a JSON array of extracted values

Return ONLY a JSON array of strings or simple values.
Rules:
- Return a JSON array of strings or simple values
- Each array element should be a single extracted value
- Remove duplicates
- Be ABSOLUTELY CONSISTENT with formatting - all similar values must match exactly
- Normalize values according to the prompt's guidance
- If nothing can be extracted, return an empty array []

Example outputs (note consistency):
["Apartment", "House", "Flat"]  // Consistent capitalization and exact format
["2", "3", "4", "1"]  // All single digits, consistent format
["London", "Manchester", "Birmingham"]  // Standardized city names
["Elephant & Castle London", "Shoreditch London"]  // Consistent format with city`;

  let metadataText = "";
  if (metadata && Object.keys(metadata).length > 0) {
    metadataText = `\n\nMetadata:\n${JSON.stringify(metadata, null, 2)}`;
  }

  const userPrompt = `${prompt}

IMPORTANT: Absolute consistency is required for proper data aggregation across all properties.
Ensure all extracted values use the exact format and standardization specified above.

Content to analyze:
${content}${metadataText}

Return only the JSON array.`;

  logger.info("🤖 Calling AI for custom extraction", {
    model,
    contentLength: content.length,
    hasMetadata: !!metadata,
  });

  const { text } = await generateText({
    model: openrouter(model),
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
    
    const extracted = JSON.parse(jsonText);
    
    if (!Array.isArray(extracted)) {
      throw new Error("Response is not an array");
    }

    // Filter to only string/number values and remove duplicates
    const uniqueValues = Array.from(
      new Set(
        extracted
          .filter((v) => typeof v === "string" || typeof v === "number")
          .map((v) => String(v))
      )
    );
    
    logger.info(`✅ Extracted ${uniqueValues.length} values`, {
      values: uniqueValues.slice(0, 10), // Log first 10 for debugging
    });

    return uniqueValues;
  } catch (parseError) {
    logger.error("Failed to parse AI response as JSON array", {
      parseError,
      response: text.slice(0, 500),
    });
    throw new Error(`Failed to parse extraction from AI response: ${parseError}`);
  }
}

/**
 * Store extraction result in database
 */
async function storeExtractionResult(
  supabase: SupabaseClient,
  extractionId: string,
  itemId: string,
  extractedData: string[],
  status: "completed" | "failed",
  errorMessage?: string
): Promise<void> {
  const { error } = await supabase
    .from("knowledge_base_item_extractions")
    .insert({
      extraction_id: extractionId,
      knowledge_base_item_id: itemId,
      extracted_data: extractedData,
      status,
      error_message: errorMessage,
    });

  if (error) {
    logger.error("Failed to store extraction result", { error, extractionId, itemId });
    throw error;
  }

  logger.info("✅ Stored extraction result", { extractionId, itemId, status });
}


/**
 * Main task: Extract custom data for a knowledge base item
 */
export const extractCustomData = schemaTask({
  id: "extract-custom-data",
  schema: z.object({
    extractionId: z.string().uuid(),
    knowledgeBaseItemId: z.string().uuid(),
    prompt: z.string(),
    model: z.enum(["openai/gpt-5-nano", "openai/gpt-5-mini", "google/gemini-2.5-flash"]),
  }),
  machine: {
    preset: "small-1x",
  },
  queue: {
    concurrencyLimit: 5,
  },
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 2_000,
    maxTimeoutInMs: 30_000,
    randomize: true,
  },
  run: async (payload, { ctx }) => {
    const { extractionId, knowledgeBaseItemId, prompt, model } = payload;

    logger.info("🚀 Starting custom data extraction", {
      extractionId,
      itemId: knowledgeBaseItemId,
      model,
      attemptNumber: ctx.attempt.number,
    });

    const supabase = createSupabaseClient();
    const isFinalAttempt = ctx.attempt.number === 3;

    try {
      // Fetch the item
      const item = await fetchKnowledgeBaseItem(supabase, knowledgeBaseItemId);
      
      logger.info(`📄 Processing item: ${item.name}`, {
        type: item.type,
      });

      // Fetch all documents
      const documents = await fetchDocumentContent(supabase, knowledgeBaseItemId);
      
      if (documents.length === 0) {
        logger.warn("⚠️ No documents found for item, using item text_content if available");
      }

      // Combine all content
      const combinedContent = documents.map((doc) => doc.content).join("\n\n");
      const contentToAnalyze = combinedContent || item.text_content || "";

      if (!contentToAnalyze) {
        logger.warn("⚠️ No content available to extract data from");
        await storeExtractionResult(supabase, extractionId, knowledgeBaseItemId, [], "completed");
        return {
          success: true,
          itemId: knowledgeBaseItemId,
          extracted: [],
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

      // Extract data using AI
      const extracted = await extractDataWithAI(contentToAnalyze, prompt, model, combinedMetadata);

      // Store result
      await storeExtractionResult(supabase, extractionId, knowledgeBaseItemId, extracted, "completed");

      logger.info("✅ Custom extraction completed", {
        extractionId,
        itemId: knowledgeBaseItemId,
        extractedCount: extracted.length,
      });

      return {
        success: true,
        itemId: knowledgeBaseItemId,
        extracted,
        extractedCount: extracted.length,
      };
    } catch (error) {
      logger.error("❌ Custom extraction failed", {
        error,
        extractionId,
        itemId: knowledgeBaseItemId,
        attemptNumber: ctx.attempt.number,
        isFinalAttempt,
      });

      // Only store failure on final attempt
      if (isFinalAttempt) {
        try {
          await storeExtractionResult(
            supabase,
            extractionId,
            knowledgeBaseItemId,
            [],
            "failed",
            error instanceof Error ? error.message : "Unknown error"
          );
        } catch (storeError) {
          logger.error("Failed to store extraction failure", { storeError });
        }
      }

      throw error;
    }
  },
});

