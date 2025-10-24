# Contextual Retrieval Implementation

## Overview

We've implemented **Contextual Retrieval**, a technique developed by Anthropic that significantly improves retrieval accuracy in RAG (Retrieval-Augmented Generation) systems by adding context to each chunk before embedding.

**Research Source**: [Anthropic's Contextual Retrieval Engineering Post](https://www.anthropic.com/engineering/contextual-retrieval)

## The Problem

Traditional RAG systems chunk documents into smaller pieces for efficient retrieval. However, this approach often destroys context. For example:

**Original chunk (lacks context):**
```
"The company's revenue grew by 3% over the previous quarter."
```

This chunk doesn't specify which company or time period, making it difficult to retrieve correctly when users ask specific questions.

## The Solution

Before embedding each chunk, we use Claude (via OpenRouter) to generate a short contextual summary that situates the chunk within the whole document:

**Contextualized chunk:**
```
This chunk is from an SEC filing on ACME corp's performance in Q2 2023; 
the previous quarter's revenue was $314 million. The company's revenue 
grew by 3% over the previous quarter.
```

This contextualized version is then embedded, allowing the retrieval system to find the right information more accurately.

## Performance Improvements

According to Anthropic's research:

- **49% reduction** in failed retrievals (using Contextual Embeddings + Contextual BM25)
- **67% reduction** in failed retrievals (when combined with reranking)
- Works across various knowledge domains (codebases, documentation, research papers, etc.)

## Implementation Details

### 1. Core Components

**File**: `lib/embeddings/processor.ts`

#### Key Function: `generateChunkContext()`

```typescript
async function generateChunkContext(
  wholeDocument: string,
  chunkContent: string
): Promise<string>
```

This function:
- Takes the entire document and a specific chunk
- Uses Claude 3.5 Haiku via OpenRouter for cost-effective context generation
- Returns a concise (50-100 token) context summary
- Gracefully handles failures by returning empty string

#### Updated Function: `processTextWithEmbeddings()`

```typescript
export async function processTextWithEmbeddings(
  text: string,
  chunkSize: number = 512,
  overlap: number = 50,
  useContextualRetrieval: boolean = true
): Promise<Array<DocumentChunk & { embedding: number[] }>>
```

New features:
- Optional `useContextualRetrieval` parameter (default: `true`)
- For each chunk, generates contextual information
- Prepends context to chunk before embedding
- Stores the contextualized version in the database

### 2. Processing Pipeline

```
┌─────────────────┐
│  Raw Document   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Chunk Text     │  (Using LangChain splitter)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  For Each Chunk │
│  ┌───────────┐  │
│  │ Generate  │  │  (Claude via OpenRouter)
│  │ Context   │  │
│  └─────┬─────┘  │
│        │        │
│  ┌─────▼─────┐  │
│  │  Prepend  │  │  (Context + "\n\n" + Chunk)
│  │  Context  │  │
│  └─────┬─────┘  │
│        │        │
│  ┌─────▼─────┐  │
│  │  Generate │  │  (Voyage AI embeddings)
│  │ Embedding │  │
│  └───────────┘  │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│ Store in Vector │
│    Database     │
└─────────────────┘
```

### 3. Technology Stack

- **Vercel AI SDK**: Modern LLM interaction framework
- **OpenRouter**: API gateway for accessing Claude models
- **Claude 3.5 Haiku**: Fast, cost-effective model for context generation
- **Voyage AI**: High-quality embedding model

### 4. Retry Logic

The implementation includes robust retry logic for:

- **Rate limiting** (429 errors): Exponential backoff with jitter, respects `Retry-After` headers
- **Transient errors**: Shorter exponential backoff
- **Task-level retries**: Handles catastrophic failures

See `src/trigger/process-items.ts` header documentation for detailed retry strategy.

## Environment Variables Required

```bash
# OpenRouter for context generation
OPENROUTER_API_KEY=your_openrouter_key

# Voyage AI for embeddings
VOYAGE_API_KEY=your_voyage_key

# Firecrawl for URL scraping
FIRECRAWL_API_KEY=your_firecrawl_key

# Supabase for storage
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

## Usage

### Automatic (Default)

Contextual Retrieval is **enabled by default** for all knowledge base items processed through the Trigger.dev task:

```typescript
// In your code that triggers the task
await tasks.trigger("process-item", {
  knowledgeBaseItemId: itemId,
});
```

### Manual Control

If you need to disable Contextual Retrieval for specific use cases:

```typescript
import { processTextWithEmbeddings } from '@/lib/embeddings/processor';

// Without Contextual Retrieval
const chunks = await processTextWithEmbeddings(
  text,
  512,  // chunkSize
  50,   // chunkOverlap
  false // useContextualRetrieval
);

// With Contextual Retrieval (default)
const contextualChunks = await processTextWithEmbeddings(
  text,
  512,  // chunkSize
  50,   // chunkOverlap
  true  // useContextualRetrieval (can be omitted)
);
```

## Cost Considerations

### Context Generation Costs

According to Anthropic's research, with their Claude API:
- **One-time cost**: $1.02 per million document tokens
- Assumes: 800 token chunks, 8k token documents, 100 tokens context per chunk

With OpenRouter and Haiku:
- Costs may vary based on OpenRouter's pricing
- Haiku is optimized for cost-effectiveness
- Context generation happens only once during indexing

### Cost Optimization

The prompt is designed to be efficient:
- Uses the fast Haiku model (not Opus or Sonnet)
- Limits context to ~100 tokens per chunk
- Gracefully fails (returns empty string) if context generation fails
- Sequential processing prevents overwhelming the API

## Monitoring and Logging

The implementation includes comprehensive logging:

```
[processTextWithEmbeddings] Chunking text: 45000 characters
[processTextWithEmbeddings] Created 23 chunks
[processTextWithEmbeddings] Using Contextual Retrieval for improved accuracy
[processTextWithEmbeddings] Processing chunk 1/23 (1850 chars)
[processTextWithEmbeddings] Added context (87 chars) to chunk 1
[processTextWithEmbeddings] Processing chunk 2/23 (1920 chars)
[processTextWithEmbeddings] Added context (92 chars) to chunk 2
...
[processTextWithEmbeddings] Successfully generated 23 embeddings
```

## Future Enhancements

Based on Anthropic's research, potential improvements include:

1. **Reranking**: Add a reranking step using Cohere or Voyage rerankers
   - Can improve accuracy by additional 18% (67% total reduction in failures)

2. **BM25 Integration**: Combine with BM25 for hybrid search
   - Better exact match capabilities
   - Improved performance on technical terms and identifiers

3. **Custom Prompts**: Tailor context generation prompts for specific domains
   - Include domain-specific glossaries
   - Add business-specific context

4. **Prompt Caching**: Use Claude's prompt caching for cost reduction
   - Cache the document context for all chunks
   - Reduces costs by up to 90%

## References

- [Anthropic: Contextual Retrieval](https://www.anthropic.com/engineering/contextual-retrieval)
- [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)
- [OpenRouter API Documentation](https://openrouter.ai/docs)
- [Voyage AI Embeddings](https://www.voyageai.com/)

## Troubleshooting

### Context Generation Failures

If context generation fails:
- The system gracefully continues without context
- Check `OPENROUTER_API_KEY` environment variable
- Review OpenRouter dashboard for API errors
- Check logs for rate limiting issues

### High Costs

If costs are unexpectedly high:
- Verify you're using Haiku (not Sonnet or Opus)
- Check document sizes (very large documents generate more contexts)
- Consider disabling for certain content types if not beneficial

### Poor Retrieval Accuracy

If retrieval isn't improving:
- Ensure Contextual Retrieval is enabled (`useContextualRetrieval: true`)
- Check that contexts are being generated (review logs)
- Consider customizing the context generation prompt for your domain
- Verify embeddings are being generated from contextualized chunks

