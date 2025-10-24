# Knowledge Bases

## Overview

Knowledge bases store indexed documents and data that can be searched using semantic search (vector embeddings). The system supports a parent-child relationship for complex items like property agents that manage multiple sub-items.

## Tables

### `knowledge_bases`

Stores the top-level knowledge base containers.

#### Columns

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key, auto-generated |
| `name` | `varchar(255)` | Name of the knowledge base |
| `description` | `text` | Optional description |
| `organization_id` | `uuid` | Foreign key to `organisations` table |
| `created_at` | `timestamp with time zone` | Timestamp when created |
| `updated_at` | `timestamp with time zone` | Timestamp when last updated |

#### Indexes

- `idx_knowledge_bases_organization_id` on `organization_id`

### `knowledge_base_items`

Stores individual items within a knowledge base. Supports parent-child relationships for complex item types.

#### Columns

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key, auto-generated |
| `knowledge_base_id` | `uuid` | Foreign key to `knowledge_bases` table |
| `parent_item_id` | `uuid` | Foreign key to parent item (nullable, self-referential) |
| `name` | `varchar(500)` | Name/title of the item |
| `type` | `varchar(50)` | Item type (see Item Types below) |
| `url` | `text` | URL (for url, rightmove_property types) |
| `text_content` | `text` | Direct text content (for text type) |
| `file_type` | `varchar(100)` | File MIME type (for file type) |
| `file_location` | `text` | Storage path in Supabase Storage (for file type) |
| `file_size` | `bigint` | File size in bytes (for file type) |
| `connection_type` | `varchar(50)` | External connection type (for synced items) |
| `connection_id` | `varchar(255)` | External connection ID |
| `external_id` | `varchar(500)` | External system ID (e.g., Rightmove property ID) |
| `external_url` | `text` | External system URL |
| `external_modified_at` | `timestamp with time zone` | Last modified time in external system |
| `status` | `varchar(50)` | Processing status: `pending`, `processing`, `indexed`, `failed` |
| `chunk_size` | `integer` | Text chunk size for embeddings (default: 512) |
| `chunk_overlap` | `integer` | Overlap between chunks (default: 50) |
| `metadata` | `jsonb` | Extensible metadata (see Metadata Schemas below) |
| `last_synced_at` | `timestamp with time zone` | Last successful sync time |
| `sync_error` | `text` | Error message if sync failed |
| `created_at` | `timestamp with time zone` | Timestamp when created |
| `updated_at` | `timestamp with time zone` | Timestamp when last updated |
| `deleted_at` | `timestamp with time zone` | Soft delete timestamp |

#### Item Types

| Type | Description | Parent/Child |
|------|-------------|--------------|
| `url` | Single web page fetched via Firecrawl | Standalone |
| `text` | Direct text content | Standalone |
| `file` | Uploaded file (PDF, DOCX, etc.) | Standalone |
| `notion` | Notion page/database sync | Standalone |
| `gdrive` | Google Drive file sync | Standalone |
| `onedrive` | OneDrive file sync | Standalone |
| `dropbox` | Dropbox file sync | Standalone |
| `rightmove_agent` | Rightmove property scraper agent | Parent |
| `rightmove_property` | Individual Rightmove property | Child of `rightmove_agent` |

#### Indexes

- `idx_knowledge_base_items_kb_id` on `knowledge_base_id`
- `idx_knowledge_base_items_parent_id` on `parent_item_id`
- `idx_knowledge_base_items_type` on `type`
- `idx_knowledge_base_items_status` on `status`
- `idx_knowledge_base_items_metadata` (GIN index on `metadata`)
- `idx_knowledge_base_items_created_at` on `created_at`

### `knowledge_base_documents`

Stores chunked documents with vector embeddings for semantic search.

#### Columns

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key, auto-generated |
| `knowledge_base_id` | `uuid` | Foreign key to `knowledge_bases` table |
| `knowledge_base_item_id` | `uuid` | Foreign key to `knowledge_base_items` table |
| `content` | `text` | Text content of the chunk |
| `embedding` | `vector(1536)` | Vector embedding (Voyage AI dimension) |
| `chunk_index` | `integer` | Index of this chunk within the item |
| `chunk_total` | `integer` | Total number of chunks for the item |
| `token_count` | `integer` | Number of tokens in this chunk |
| `page_number` | `integer` | Page number (for PDFs/docs) |
| `section_title` | `text` | Section title (for structured docs) |
| `metadata` | `jsonb` | Additional metadata |
| `created_at` | `timestamp with time zone` | Timestamp when created |
| `updated_at` | `timestamp with time zone` | Timestamp when last updated |

#### Indexes

- `idx_kb_documents_kb_id` on `knowledge_base_id`
- `idx_kb_documents_kb_item_id` on `knowledge_base_item_id`
- `idx_kb_documents_chunk_index` on `(knowledge_base_item_id, chunk_index)`
- `idx_kb_documents_metadata` (GIN index on `metadata`)

## Parent-Child Relationships

Some item types act as "agents" that generate child items. The parent-child relationship is managed via the `parent_item_id` foreign key with CASCADE delete.

### Rightmove Agent

The `rightmove_agent` type is a parent item that scrapes property listings from Rightmove using Apify and creates child `rightmove_property` items.

#### Metadata Schema for `rightmove_agent`

```typescript
interface RightmoveAgentConfig {
  rentUrl?: string;     // Rightmove URL for rental properties (optional)
  saleUrl?: string;     // Rightmove URL for sale properties (optional)
  syncSchedule: 'daily' | 'weekly';  // Future: automated sync schedule
}
```

**Note**: At least one URL (rentUrl or saleUrl) must be provided.

#### Example

```json
{
  "rentUrl": "https://www.rightmove.co.uk/property-to-rent/find/Aston-Gray/Maidenhead.html?...",
  "saleUrl": "https://www.rightmove.co.uk/property-for-sale/find/Aston-Gray/Maidenhead.html?...",
  "syncSchedule": "daily"
}
```

Or with just one URL:

```json
{
  "saleUrl": "https://www.rightmove.co.uk/property-for-sale/find/Aston-Gray/Maidenhead.html?...",
  "syncSchedule": "daily"
}
```

### Rightmove Property

Child items of type `rightmove_property` store individual property data. The full Apify JSON response is stored in both the item's `metadata` field and in each document chunk's `metadata` field for efficient retrieval.

#### Stored Fields

- `url`: Property URL on Rightmove
- `external_id`: Rightmove property ID (from `id` field in Apify data)
- `metadata`: Complete property JSON from Apify (address, price, beds, baths, description, images, features, etc.)
- `parent_item_id`: Links back to the `rightmove_agent` parent

#### Searchable Text

Only concise, relevant text is embedded:
- Title
- Address
- Description (first 500 chars)
- Beds and baths
- Property type and subtype
- Primary price
- Top 5 features

This ensures efficient search while the full data remains accessible in both the item's `metadata` and in each chunk's `metadata` field.

#### Document Chunks

Each property generates one or more document chunks (depending on text length). Every chunk includes:
- `content`: The concise searchable text
- `embedding`: Vector embedding for semantic search
- `metadata`: Complete property JSON, making all property details immediately available in search results without additional database queries

## Processing Pipeline

Knowledge base items are processed asynchronously using Trigger.dev tasks with a modular processor architecture.

### Task: `process-item`

Entry point task that routes to type-specific processors.

**Location**: `website/src/trigger/process-items.ts`

### Processors

Each item type has a dedicated processor:

| Processor | Location | Description |
|-----------|----------|-------------|
| `processUrl` | `processors/url.ts` | Fetches content via Firecrawl API, generates embeddings |
| `processText` | `processors/text.ts` | Directly processes text content, generates embeddings |
| `processRightmoveAgent` | `processors/rightmove-agent.ts` | Scrapes properties via Apify, creates child items |

### Rightmove Agent Processing Flow

1. **Fetch parent item**: Load `rightmove_agent` item from database
2. **Extract config**: Get `rentUrl` and `saleUrl` from metadata
3. **Call Apify**: Scrape properties using Apify actor `LwR6JRNl4khcKXIWo`
4. **Delete old children**: Remove existing `rightmove_property` items (clean slate)
5. **For each property**:
   - Create `rightmove_property` item with full JSON in metadata
   - Generate concise text for embedding
   - Create embeddings using Voyage AI
   - Store chunks in `knowledge_base_documents`
   - Update status to `indexed`
6. **Complete**: Update parent status

### Retry Strategy

- **API-level retries**: 5 attempts with exponential backoff for rate limits
- **Task-level retries**: 5 attempts by Trigger.dev for hard failures
- **Respects Retry-After headers** from APIs
- **Continues on partial failures**: If one property fails, others continue processing

## API Endpoints

### Create Knowledge Base

```typescript
POST /api/[slug]/knowledge-bases
Body: { name: string, description?: string }
```

### Add Single Item

```typescript
POST /api/[slug]/knowledge-bases/[id]/items
Body: FormData with type, name, and type-specific fields
```

### Add Bulk Items

```typescript
POST /api/[slug]/knowledge-bases/[id]/items/bulk
Body: { items: Array<{ name, url, type }> }
```

Automatically filters out duplicate URLs and returns detailed results.

### List Items

```typescript
GET /api/[slug]/knowledge-bases/[id]/items
```

Returns all items including parent-child relationships.

## Usage Examples

### Create a Rightmove Agent

```typescript
// 1. Create the parent agent item
const response = await fetch(`/api/${slug}/knowledge-bases/${kbId}/items`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'rightmove_agent',
    name: 'Aston Gray Properties',
    metadata: {
      rentUrl: 'https://www.rightmove.co.uk/property-to-rent/find/Aston-Gray/Maidenhead.html?...',
      saleUrl: 'https://www.rightmove.co.uk/property-for-sale/find/Aston-Gray/Maidenhead.html?...',
      syncSchedule: 'daily'
    }
  })
});

// 2. Trigger processing (automatically triggered on creation)
// This will scrape properties and create child items
```

### Query Properties

```typescript
// Properties are automatically searchable via vector embeddings
// Search for "3 bedroom house under £500k"
// Returns relevant rightmove_property items with full metadata
```

## Migrations

- `20251018000000_knowledge_bases.sql` - Initial tables
- `20251020000000_knowledge_base_documents.sql` - Vector embeddings table
- `20251020100000_add_chunking_remove_ragie.sql` - Chunking config
- `20251023124651_rightmove_agent_support.sql` - Parent-child relationships

## Future Extensions

The parent-child architecture supports extensibility for future agent types:

- **Zoopla Agent**: Similar to Rightmove, for Zoopla properties
- **OnTheMarket Agent**: For OnTheMarket properties
- **Web Crawler Agent**: Recursively crawl entire websites
- **RSS Feed Agent**: Monitor RSS feeds and index new items
- **Database Agent**: Sync data from external databases

Each new agent type requires:
1. New type in `knowledge_base_items` type constraint
2. Metadata schema definition in TypeScript types
3. New processor in `processors/` directory
4. Registration in processor registry in `process-items.ts`

