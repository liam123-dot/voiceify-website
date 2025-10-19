# Tools Tables

## Tools Table

The `tools` table stores tool integrations that belong to organizations.

### Schema

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key, auto-generated |
| `organization_id` | `uuid` | Foreign key to `organizations` table |
| `name` | `text` | Name of the tool (2-50 characters) |
| `label` | `text` | Display label for the tool |
| `description` | `text` | Description of what the tool does |
| `type` | `text` | Tool type: 'sms', 'transfer_call', 'api_request', 'pipedream_action' |
| `function_schema` | `jsonb` | JSON schema for AI function calling |
| `static_config` | `jsonb` | Pre-configured values (hidden from AI) |
| `config_metadata` | `jsonb` | Full configuration for UI reconstruction |
| `async` | `boolean` | If true, agent won't wait for response |
| `created_at` | `timestamp with time zone` | Timestamp when the tool was created |
| `updated_at` | `timestamp with time zone` | Timestamp when the tool was last updated |

### Indexes

- `tools_organization_id_idx` on `organization_id`

### Row Level Security (RLS)

RLS is enabled on this table. Policies ensure that:

- **INSERT**: Users can only create tools for organizations they belong to
- **SELECT**: Users can only view tools from organizations they belong to
- **UPDATE**: Users can only update tools from organizations they belong to
- **DELETE**: Users can only delete tools from organizations they belong to

### Triggers

- `update_tools_updated_at`: Automatically updates the `updated_at` column on record updates

## Agent Tools Table

The `agent_tools` table is a junction table that links agents to tools, allowing agents to use specific tools.

### Schema

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key, auto-generated |
| `agent_id` | `uuid` | Foreign key to `agents` table |
| `tool_id` | `uuid` | Foreign key to `tools` table |
| `created_at` | `timestamp with time zone` | Timestamp when the link was created |

### Indexes

- `agent_tools_agent_id_idx` on `agent_id`
- `agent_tools_tool_id_idx` on `tool_id`

### Constraints

- Unique constraint on `(agent_id, tool_id)` - prevents duplicate links

### Row Level Security (RLS)

RLS is enabled on this table. Policies ensure that:

- **INSERT**: Users can only create links for agents in their organizations
- **SELECT**: Users can only view links for agents in their organizations
- **DELETE**: Users can only delete links for agents in their organizations

## Usage

### Creating a Tool

Use the `/api/tools` POST endpoint:

```typescript
const response = await fetch('/api/tools', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ name: 'Calendar Integration' }),
})

const data = await response.json()
// { tool: { id, organization_id, name, created_at, updated_at } }
```

### Fetching Tools

Use the `/api/tools` GET endpoint:

```typescript
const response = await fetch('/api/tools')
const data = await response.json()
// { tools: [...] }
```

### Linking a Tool to an Agent

To be implemented - will allow associating tools with agents so they can use those tools.

## Relationships

- Each tool belongs to one organization (`organization_id` → `organizations.id`)
- Tools are automatically deleted when their organization is deleted (CASCADE)
- Tools can be linked to multiple agents through the `agent_tools` junction table
- Agents can have multiple tools through the `agent_tools` junction table

## Tool Types

### SMS Tool

Send SMS messages during agent conversations.

**Configuration Fields:**

- `from`: Sender phone number configuration
  - `type`: Either `'called_number'` (automatic) or `'specific_number'`
  - `phone_number_id`: UUID of phone number (required when type is `'specific_number'`)
- `text`: Message content (fixed value or AI-generated)
- `recipients`: Phone number(s) to send to (fixed, AI-generated, or array_extendable)

**Example Configuration:**

```typescript
{
  type: 'sms',
  label: 'Send Confirmation SMS',
  description: 'Send a confirmation message to the customer',
  from: {
    type: 'called_number' // Uses the number the customer called
  },
  text: {
    mode: 'fixed',
    value: 'Thank you for your call! Your appointment is confirmed for {{appointment_time}}.'
  },
  recipients: {
    mode: 'ai',
    prompt: 'Extract the customer phone number from the conversation',
    schema: z.array(z.string())
  }
}
```

### Transfer Call Tool

Transfer the call to another agent or phone number.

### API Request Tool

Make HTTP requests to external APIs.

### Pipedream Action Tool

Execute Pipedream actions and workflows.

## Dynamic Variables

Tool parameters support dynamic variables that are substituted at runtime. Variables are denoted with double curly braces: `{{variable_name}}`.

### Available Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `{{caller_phone_number}}` | The phone number of the person calling the agent | `+1234567890` |
| `{{called_phone_number}}` | The phone number that was called (agent's number) | `+1987654321` |

**Usage Examples:**

```
"Send SMS to {{caller_phone_number}} with appointment details"
"Your call to {{called_phone_number}} has been received"
"Text from {{called_phone_number}}: Thank you for calling!"
```

Variables work in both fixed values and AI-generated parameters. They are detected automatically in the UI and displayed with badges showing their description.

## Migration

Applied in migration: `20251007114145_create_tools_tables.sql`

