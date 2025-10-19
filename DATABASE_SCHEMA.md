# Database Schema

## Tables

### organizations
```sql
create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table organizations enable row level security;

-- Create policies
create policy "Users can view their own organization"
  on organizations for select
  using (auth.uid() in (
    select user_id from user_organizations where organization_id = id
  ));
```

### user_organizations
This is a junction table that links users to organizations.

```sql
create table user_organizations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  organization_id uuid references organizations not null,
  role text default 'member',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, organization_id)
);

-- Enable RLS
alter table user_organizations enable row level security;

-- Create policies
create policy "Users can view their own organization memberships"
  on user_organizations for select
  using (auth.uid() = user_id);

create policy "Users can insert their own organization memberships"
  on user_organizations for insert
  with check (auth.uid() = user_id);
```

## Setup Instructions

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Run the SQL commands above to create the tables
4. The tables will automatically have Row Level Security (RLS) enabled
5. Update your `.env.local` file with your Supabase credentials:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your anon/public key

## Notes

- Each user must be attached to an organization
- During signup, users will create their own organization
- No organization or user management features are implemented yet
- The `role` field in `user_organizations` is reserved for future use
