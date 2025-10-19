# Organisations Table

## Schema

```sql
CREATE TABLE IF NOT EXISTS public.organisations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id TEXT NOT NULL UNIQUE, -- WorkOS organization ID
    slug TEXT NOT NULL UNIQUE, -- URL-friendly identifier
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
```

## Fields

- `id`: UUID - Primary key, auto-generated
- `external_id`: TEXT - WorkOS organization ID, unique
- `slug`: TEXT - URL-friendly identifier, unique, auto-generated from organization name
- `permissions`: JSONB - Permission categories and individual permissions (see below)
- `created_at`: TIMESTAMP - Auto-generated timestamp
- `updated_at`: TIMESTAMP - Auto-updated timestamp

## Indexes

- `idx_organisations_external_id` - Index on external_id for fast lookups

## Slug Generation

When a new organization is created:
1. The organization name is fetched from WorkOS
2. A slug is generated using the `slugify()` function:
   - Convert to lowercase
   - Remove special characters (except hyphens and underscores)
   - Replace spaces and multiple hyphens with single hyphens
   - Remove leading/trailing hyphens
3. If the slug already exists, append a number (e.g., `organization-name-1`, `organization-name-2`)

## Permissions Structure

The `permissions` field is a JSONB array containing permission categories:

```typescript
interface Permission {
  id: string;
  label: string;
  enabled: boolean;
}

interface PermissionCategory {
  id: string;
  title: string;
  permissions: Permission[];
}
```

### Default Permission Categories

1. **Agents** (`agents`)
   - `agents.view` - View Agents
   - `agents.create` - Create Agents
   - `agents.edit` - Edit Agents
   - `agents.delete` - Delete Agents

2. **Knowledge Bases** (`knowledge-bases`)
   - `knowledge-bases.view` - View Knowledge Bases
   - `knowledge-bases.create` - Create Knowledge Bases
   - `knowledge-bases.edit` - Edit Knowledge Bases
   - `knowledge-bases.delete` - Delete Knowledge Bases

3. **Tools** (`tools`)
   - `tools.view` - View Tools
   - `tools.create` - Create Tools
   - `tools.edit` - Edit Tools
   - `tools.delete` - Delete Tools

4. **Credentials** (`credentials`)
   - `credentials.view` - View Credentials
   - `credentials.create` - Create Credentials
   - `credentials.edit` - Edit Credentials
   - `credentials.delete` - Delete Credentials

5. **Phone Numbers** (`phone-numbers`)
   - `phone-numbers.view` - View Phone Numbers
   - `phone-numbers.create` - Create Phone Numbers
   - `phone-numbers.edit` - Edit Phone Numbers
   - `phone-numbers.delete` - Delete Phone Numbers

All permissions default to `enabled: false` when an organization is created.

## Row Level Security

RLS is enabled on this table. Currently:
- Authenticated users can view all organizations
- Write operations are handled through the API

## Related Tables

- Links to `agents` via `organization_id`
- Links to `tools` via `organization_id`
- Links to `phone_numbers` via `organization_id`

## Synchronization with WorkOS

When a new organization is created in our database:
1. The internal UUID `id` is synced back to WorkOS as the `externalId`
2. This allows WorkOS to reference our internal organization ID
3. If the sync fails, the organization is still created (sync is non-blocking)

