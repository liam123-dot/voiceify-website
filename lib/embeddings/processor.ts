// Embedding and Chunking Utilities

import { encode, decode } from 'gpt-tokenizer'
// Commented out - switched to Voyage AI embeddings
// import OpenAI from 'openai';
import type { DocumentChunk, EmbeddingResult } from '@/types/knowledge-base';

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
 * Uses gpt-tokenizer for accurate token counting
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

  // Encode the entire text to tokens
  const tokens = encode(text);
  const totalTokens = tokens.length;

  // If text is shorter than chunk size, return as single chunk
  if (totalTokens <= chunkSize) {
    return [{
      content: text,
      chunkIndex: 0,
      chunkTotal: 1,
      tokenCount: totalTokens,
    }];
  }

  const chunks: DocumentChunk[] = [];
  let startIdx = 0;
  let chunkIndex = 0;

  while (startIdx < totalTokens) {
    // Get chunk tokens
    const endIdx = Math.min(startIdx + chunkSize, totalTokens);
    const chunkTokens = tokens.slice(startIdx, endIdx);
    
    // Decode tokens back to text
    const chunkText = decode(chunkTokens);
    
    // Try to split at sentence boundary if not at the end
    let finalChunkText = chunkText;
    let actualTokenCount = chunkTokens.length;
    
    if (endIdx < totalTokens) {
      // Look for sentence boundaries (. ! ? followed by space or newline)
      const sentenceEndings = /[.!?][\s\n]/g;
      const matches = Array.from(chunkText.matchAll(sentenceEndings));
      
      if (matches.length > 0) {
        // Find the last sentence boundary in the last 20% of the chunk
        const cutoffPoint = Math.floor(chunkText.length * 0.8);
        const viableMatches = matches.filter((m: RegExpMatchArray) => (m.index || 0) > cutoffPoint);
        
        if (viableMatches.length > 0) {
          const lastMatch = viableMatches[viableMatches.length - 1];
          const cutPoint = (lastMatch.index || 0) + lastMatch[0].length;
          finalChunkText = chunkText.substring(0, cutPoint);
          actualTokenCount = encode(finalChunkText).length;
        }
      }
    }

    chunks.push({
      content: finalChunkText.trim(),
      chunkIndex,
      tokenCount: actualTokenCount,
    });

    // Move start index forward, accounting for overlap
    startIdx = startIdx + actualTokenCount - overlap;
    chunkIndex++;
  }

  // Set total count on all chunks
  chunks.forEach(chunk => {
    chunk.chunkTotal = chunks.length;
  });

  return chunks;
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
 * Process text: chunk and generate embeddings
 * @param text - The text to process
 * @param chunkSize - Target size in tokens per chunk
 * @param overlap - Number of overlapping tokens between chunks
 * @returns Array of chunks with embeddings
 */
export async function processTextWithEmbeddings(
  text: string,
  chunkSize: number = 512,
  overlap: number = 50
): Promise<Array<DocumentChunk & { embedding: number[] }>> {
  // Chunk the text
  const chunks = await chunkText(text, chunkSize, overlap);
  
  // Generate embeddings for each chunk with rate limiting
  const chunksWithEmbeddings: Array<DocumentChunk & { embedding: number[] }> = [];
  
  for (const chunk of chunks) {
    try {
      const result = await generateEmbedding(chunk.content);
      chunksWithEmbeddings.push({
        ...chunk,
        embedding: result.embedding,
        tokenCount: result.tokenCount, // Use actual token count from embedding API
      });
      
      // Small delay to avoid rate limits (adjust as needed)
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      // Re-throw to be handled by caller
      throw error;
    }
  }
  
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

