// Embedding and Chunking Utilities with Contextual Retrieval

import { encode } from 'gpt-tokenizer'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
// Commented out - switched to Voyage AI embeddings
// import OpenAI from 'openai';
import type { DocumentChunk, EmbeddingResult } from '@/types/knowledge-base';

// Initialize OpenRouter client
const openrouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

// Commented out - switched to Voyage AI embeddings
// // Initialize OpenAI client
// let openaiClient: OpenAI | null = null;
// 
// function getOpenAIClient(): OpenAI {
//   if (!openaiClient) {
//     const apiKey = process.env.OPENAI_API_KEY;
//     if (!apiKey) {
//       throw new Error('OPENAI_API_KEY environment variable is not configured');
//     }
//     openaiClient = new OpenAI({ apiKey });
//   }
//   return openaiClient;
// }

/**
 * Chunk text into smaller pieces based on token count with overlap
 * Uses LangChain's RecursiveCharacterTextSplitter for reliable chunking
 * @param text - The text to chunk
 * @param chunkSize - Target size in tokens per chunk
 * @param overlap - Number of overlapping tokens between chunks
 * @returns Array of document chunks
 */
export async function chunkText(
  text: string,
  chunkSize: number = 512,
  overlap: number = 50
): Promise<DocumentChunk[]> {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // Calculate approximate character size from token size
  // Average ratio is roughly 4 characters per token for English text
  const charsPerToken = 4;
  const chunkSizeChars = chunkSize * charsPerToken;
  const overlapChars = overlap * charsPerToken;

  // Create LangChain text splitter
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: chunkSizeChars,
    chunkOverlap: overlapChars,
    separators: ['\n\n', '\n', '. ', '! ', '? ', '; ', ', ', ' ', ''],
  });

  // Split the text
  const textChunks = await splitter.splitText(text);

  // Convert to DocumentChunk format with accurate token counts
  const chunks: DocumentChunk[] = textChunks.map((content: string, index: number) => {
    const tokenCount = encode(content).length;
    return {
      content,
      chunkIndex: index,
      tokenCount,
      chunkTotal: textChunks.length,
    };
  });

  return chunks;
}

/**
 * Generate contextual information for a chunk using Claude via OpenRouter
 * This implements Contextual Retrieval as described in Anthropic's research:
 * https://www.anthropic.com/engineering/contextual-retrieval
 * 
 * @param wholeDocument - The entire document text
 * @param chunkContent - The specific chunk to contextualize
 * @returns Contextual information to prepend to the chunk
 */
async function generateChunkContext(
  wholeDocument: string,
  chunkContent: string
): Promise<string> {
  try {
    const { text } = await generateText({
      model: openrouter('anthropic/claude-3.5-haiku'),
      prompt: `<document>
${wholeDocument}
</document>

Here is the chunk we want to situate within the whole document:
<chunk>
${chunkContent}
</chunk>

Please give a short succinct context to situate this chunk within the overall document for the purposes of improving search retrieval of the chunk. Answer only with the succinct context and nothing else. Keep it under 100 tokens.`,
      temperature: 0,
    });

    return text.trim();
  } catch (error) {
    console.error('[generateChunkContext] Error generating context:', error);
    // If context generation fails, return empty string to avoid blocking the pipeline
    return '';
  }
}

/**
 * Generate embedding for text using Voyage AI
 * @param text - The text to embed
 * @returns Embedding vector and token count
 */
export async function generateEmbedding(
  text: string
): Promise<EmbeddingResult> {
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }

  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error('VOYAGE_API_KEY environment variable is not configured');
  }

  try {
    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: [text],
        model: 'voyage-3.5-lite',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Voyage AI API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    if (!data.data || data.data.length === 0) {
      throw new Error('No embedding returned from Voyage AI');
    }

    const embedding = data.data[0].embedding;
    const tokenCount = data.usage?.total_tokens || 0;

    return {
      embedding,
      tokenCount,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
    throw new Error('Failed to generate embedding: Unknown error');
  }
}

// Commented out - old OpenAI embedding logic
// /**
//  * Generate embedding for text using OpenAI
//  * @param text - The text to embed
//  * @returns Embedding vector and token count
//  */
// export async function generateEmbedding(
//   text: string
// ): Promise<EmbeddingResult> {
//   if (!text || text.trim().length === 0) {
//     throw new Error('Text cannot be empty');
//   }
// 
//   const client = getOpenAIClient();
// 
//   try {
//     const response = await client.embeddings.create({
//       model: 'text-embedding-3-small',
//       input: text,
//       encoding_format: 'float',
//     });
// 
//     if (!response.data || response.data.length === 0) {
//       throw new Error('No embedding returned from OpenAI');
//     }
// 
//     const embedding = response.data[0].embedding;
//     const tokenCount = response.usage.total_tokens;
// 
//     return {
//       embedding,
//       tokenCount,
//     };
//   } catch (error) {
//     if (error instanceof Error) {
//       throw new Error(`Failed to generate embedding: ${error.message}`);
//     }
//     throw new Error('Failed to generate embedding: Unknown error');
//   }
// }

/**
 * Process text: chunk, add context, and generate embeddings
 * 
 * Implements Contextual Retrieval as described by Anthropic:
 * https://www.anthropic.com/engineering/contextual-retrieval
 * 
 * For each chunk, we generate contextual information using an LLM that explains
 * what the chunk is about in the context of the whole document. This context is
 * prepended to the chunk before embedding, which significantly improves retrieval
 * accuracy (49% reduction in failed retrievals according to Anthropic's research).
 * 
 * Note: This function returns all chunks with embeddings at once.
 * For memory efficiency with large datasets, the caller should
 * store chunks in batches rather than all at once.
 * 
 * @param text - The text to process
 * @param chunkSize - Target size in tokens per chunk
 * @param overlap - Number of overlapping tokens between chunks
 * @param useContextualRetrieval - Whether to add context to chunks (default: true)
 * @returns Array of chunks with embeddings
 */
export async function processTextWithEmbeddings(
  text: string,
  chunkSize: number = 512,
  overlap: number = 50,
  useContextualRetrieval: boolean = true
): Promise<Array<DocumentChunk & { embedding: number[] }>> {
  // Chunk the text using LangChain's reliable splitter
  console.log('[processTextWithEmbeddings] Chunking text:', text.length, 'characters');
  const chunks = await chunkText(text, chunkSize, overlap);
  console.log('[processTextWithEmbeddings] Created', chunks.length, 'chunks');
  
  // Generate embeddings for each chunk sequentially
  // Sequential processing avoids overwhelming the API and manages memory
  const chunksWithEmbeddings: Array<DocumentChunk & { embedding: number[] }> = [];
  console.log('[processTextWithEmbeddings] Generating embeddings for', chunks.length, 'chunks');
  
  if (useContextualRetrieval) {
    console.log('[processTextWithEmbeddings] Using Contextual Retrieval for improved accuracy');
  }
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    try {
      console.log(`[processTextWithEmbeddings] Processing chunk ${i + 1}/${chunks.length} (${chunk.content.length} chars)`);
      
      let contentToEmbed = chunk.content;
      
      // Apply Contextual Retrieval: generate context and prepend to chunk
      if (useContextualRetrieval) {
        const context = await generateChunkContext(text, chunk.content);
        if (context) {
          // Prepend context to chunk content before embedding
          contentToEmbed = `${context}\n\n${chunk.content}`;
          console.log(`[processTextWithEmbeddings] Added context (${context.length} chars) to chunk ${i + 1}`);
        }
      }
      
      // Generate embedding for the contextualized chunk
      const result = await generateEmbedding(contentToEmbed);
      chunksWithEmbeddings.push({
        ...chunk,
        content: contentToEmbed, // Store the contextualized version
        embedding: result.embedding,
        tokenCount: result.tokenCount, // Use actual token count from embedding API
      });
      
    } catch (error) {
      console.error(`[processTextWithEmbeddings] Failed on chunk ${i + 1}/${chunks.length}:`, error);
      // Re-throw to be handled by caller
      throw error;
    }
  }
  
  console.log('[processTextWithEmbeddings] Successfully generated', chunksWithEmbeddings.length, 'embeddings');
  return chunksWithEmbeddings;
}
// 
/**
 * Extract text content from HTML
 * Basic implementation - strips HTML tags and extracts text
 * @param html - HTML content
 * @returns Plain text
 */
export function extractTextFromHTML(html: string): string {
  // Remove script and style tags and their content
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
  
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  
  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

