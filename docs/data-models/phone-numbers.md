# Phone Numbers Table

## Overview
The `phone_numbers` table stores phone numbers from various telephony providers (Twilio, etc.) that are associated with an organization. These numbers can be used by agents to make and receive calls.

## Migrations Applied
1. **Migration File**: `20251009110255_create_phone_numbers_table.sql` - Initial table creation
2. **Migration File**: `20251009110559_add_agent_id_to_phone_numbers.sql` - Added agent assignment

**Applied**: October 9, 2025

## Schema

```sql
CREATE TABLE phone_numbers (
  -- Primary identifiers
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Provider information
  provider VARCHAR(50) NOT NULL, -- 'twilio', 'vonage', etc.
  phone_number VARCHAR(20) NOT NULL, -- E.164 format (e.g., +14155551234)
  friendly_name VARCHAR(100), -- Optional friendly name for the number
  
  -- Provider credentials (encrypted in production)
  -- Store as JSONB for flexibility across different providers
  credentials JSONB NOT NULL, -- { "accountSid": "...", "authToken": "..." }
  
  -- Additional metadata
  metadata JSONB, -- { "region": "US", "capabilities": { "voice": true, "sms": true } }
  
  -- Agent assignment
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL, -- Assigned agent
  webhook_configured BOOLEAN DEFAULT FALSE, -- Whether webhook is configured with provider
  webhook_url TEXT, -- The webhook URL configured with the provider
  
  -- Status tracking
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'inactive', 'error'
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_verified_at TIMESTAMPTZ, -- Last time credentials were verified
  
  -- Constraints
  UNIQUE(organization_id, phone_number) -- Prevent duplicate numbers per org
);

-- Indexes
CREATE INDEX idx_phone_numbers_organization_id ON phone_numbers(organization_id);
CREATE INDEX idx_phone_numbers_provider ON phone_numbers(provider);
CREATE INDEX idx_phone_numbers_status ON phone_numbers(status);
CREATE INDEX idx_phone_numbers_phone_number ON phone_numbers(phone_number);
CREATE INDEX idx_phone_numbers_agent_id ON phone_numbers(agent_id);

-- Updated timestamp trigger
CREATE TRIGGER update_phone_numbers_updated_at
  BEFORE UPDATE ON phone_numbers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

## Fields Description

### Core Fields
- **id**: Unique identifier for the phone number record
- **organization_id**: Reference to the organization that owns this phone number
- **provider**: The telephony provider (e.g., 'twilio', 'vonage', 'bandwidth')
- **phone_number**: The actual phone number in E.164 format (international format)
- **friendly_name**: Optional human-readable name for the number
- **agent_id**: Reference to the agent assigned to this phone number (nullable)

### Credentials
- **credentials**: JSONB field storing provider-specific credentials
  - For Twilio: `{ "accountSid": "ACxxx...", "authToken": "xxx..." }`
  - For other providers: Store appropriate API keys/tokens
  - **IMPORTANT**: In production, these should be encrypted at rest

### Metadata
- **metadata**: JSONB field for flexible storage of provider-specific data
  - Example: `{ "region": "US/Canada", "capabilities": { "voice": true, "sms": true, "mms": false } }`
  - Can include: country code, area code, number type, features, etc.

### Webhook Configuration
- **webhook_configured**: Boolean flag indicating if the provider webhook is configured
- **webhook_url**: The URL that the provider should call for incoming calls/messages

### Status
- **status**: Current status of the phone number
  - `active`: Number is active and can be used
  - `inactive`: Number is temporarily disabled
  - `error`: There's an issue with the number or credentials

### Timestamps
- **created_at**: When the phone number was added
- **updated_at**: Last time any field was updated
- **last_verified_at**: Last time the credentials were successfully verified with the provider

## Security Considerations

### Credential Encryption
In production, the `credentials` field should be encrypted. Consider using:
1. **Supabase Vault**: For storing sensitive credentials
2. **Application-level encryption**: Encrypt before storing, decrypt when needed
3. **Environment-based secrets**: For shared credentials

Example with Supabase Vault:
```sql
-- Store credentials in Vault
INSERT INTO vault.secrets (name, secret)
VALUES ('twilio_auth_token_' || phone_number_id, auth_token);

-- Reference in phone_numbers table
credentials: { "accountSid": "ACxxx", "authTokenRef": "twilio_auth_token_123" }
```

### Row-Level Security (RLS)
```sql
-- Enable RLS
ALTER TABLE phone_numbers ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see phone numbers from their organization
CREATE POLICY phone_numbers_select_policy ON phone_numbers
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM user_organizations 
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can only insert phone numbers for their organization
CREATE POLICY phone_numbers_insert_policy ON phone_numbers
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM user_organizations 
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can only update phone numbers from their organization
CREATE POLICY phone_numbers_update_policy ON phone_numbers
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM user_organizations 
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can only delete phone numbers from their organization
CREATE POLICY phone_numbers_delete_policy ON phone_numbers
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM user_organizations 
      WHERE user_id = auth.uid()
    )
  );
```

## Relationships

### Foreign Keys
- `organization_id` → `organizations.id`: Each phone number belongs to one organization

### Related Tables (Future)
- `agent_phone_numbers`: Many-to-many relationship between agents and phone numbers
- `calls`: Each call record will reference the phone number used
- `phone_number_settings`: Additional settings like voicemail, call forwarding, etc.

## Example Data

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "organization_id": "123e4567-e89b-12d3-a456-426614174000",
  "provider": "twilio",
  "phone_number": "+14155551234",
  "friendly_name": "Customer Support Line",
  "credentials": {
    "authToken": "your_auth_token_here"
  },
  "metadata": {
    "region": "US/Canada",
    "capabilities": {
      "voice": true,
      "sms": true,
      "mms": false
    },
    "areaCode": "415",
    "state": "CA"
  },
  "status": "active",
  "created_at": "2025-10-09T12:00:00Z",
  "updated_at": "2025-10-09T12:00:00Z",
  "last_verified_at": "2025-10-09T12:00:00Z"
}
```

## API Usage

### Adding a Phone Number
```typescript
const response = await fetch('/api/{slug}/phone-numbers', {
  method: 'POST',
  body: JSON.stringify({
    provider: 'twilio',
    phoneNumber: '+14155551234',
    friendlyName: 'Customer Support',
    accountSid: 'ACxxx...',
    authToken: 'xxx...',
    metadata: {
      region: 'US/Canada',
      capabilities: { voice: true, sms: true }
    }
  })
})
```

### Fetching Available Numbers from Twilio
```typescript
const response = await fetch('/api/{slug}/phone-numbers/twilio/available', {
  method: 'POST',
  body: JSON.stringify({
    accountSid: 'ACxxx...',
    authToken: 'xxx...'
  })
})
```

## Migration Notes

When creating the migration:
1. Ensure the `organizations` and `user_organizations` tables exist first
2. Create the `update_updated_at_column()` function if it doesn't exist
3. Apply RLS policies after table creation
4. Consider creating indexes for performance
5. Test with sample data before deploying to production

## Future Enhancements

1. **Webhook Management**: Store webhook URLs for incoming calls/messages
2. **Usage Tracking**: Track number of calls made/received per number
3. **Cost Tracking**: Store cost per minute/message for billing
4. **Number Verification**: Periodic verification of credentials
5. **Multi-region Support**: Better handling of international numbers
6. **Number Capabilities**: More detailed feature flags (call recording, transcription, etc.)
7. **Provider Failover**: Support multiple providers per organization for redundancy

