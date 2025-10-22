# Clearsky AI Setup Guide

## Prerequisites

- Node.js 18+ installed
- A Supabase account (sign up at [supabase.com](https://supabase.com))

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a new project in Supabase
2. Navigate to Project Settings > API
3. Copy your project URL and anon/public key
4. Update `.env.local` with your credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Knowledge Base & Embeddings (for AI context)
OPENROUTER_API_KEY=your_openrouter_api_key  # For contextual retrieval
VOYAGE_API_KEY=your_voyage_api_key          # For embeddings
FIRECRAWL_API_KEY=your_firecrawl_api_key    # For URL scraping
```

### 3. Create Database Tables

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Run the SQL from `DATABASE_SCHEMA.md`

The schema creates:
- `organizations` table - stores organization information
- `user_organizations` table - links users to organizations

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Features

### Authentication
- **Sign Up** (`/signup`) - Create account with organization
- **Sign In** (`/signin`) - Log in to existing account
- Users must create an organization during signup
- Protected routes automatically redirect to sign in

### Dashboard Routes
- **Dashboard** (`/app`) - Main dashboard with analytics
- **Calls** (`/app/calls`) - View and manage calls
- **Agents** (`/app/agents`) - Manage AI voice agents

### Knowledge Base (Advanced)
- **Contextual Retrieval** - Implements Anthropic's research for 49% better retrieval accuracy
- Supports URLs, text content, and files
- Automatic chunking and embedding with context
- See `docs/contextual-retrieval.md` for detailed information

## Project Structure

```
Clearsky AI/
├── app/
│   ├── (dashboard)/          # Protected dashboard routes
│   │   ├── layout.tsx        # Dashboard layout with sidebar
│   │   └── app/              # Main app routes
│   │       ├── page.tsx      # Dashboard page
│   │       ├── calls/        # Calls feature
│   │       └── agents/       # Agents feature
│   ├── signup/               # Sign up page
│   ├── signin/               # Sign in page
│   └── page.tsx              # Landing page
├── components/
│   ├── ui/                   # shadcn/ui components
│   ├── app-sidebar.tsx       # Main sidebar
│   └── nav-user.tsx          # User menu
├── lib/
│   └── supabase/             # Supabase client utilities
│       ├── client.ts         # Browser client
│       ├── server.ts         # Server client
│       └── middleware.ts     # Auth middleware
└── middleware.ts             # Next.js middleware for auth
```

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **UI**: shadcn/ui with Tailwind CSS
- **Database & Auth**: Supabase
- **TypeScript**: Full type safety

## Next Steps

1. Customize the dashboard components
2. Add actual functionality to Calls and Agents pages
3. Implement organization management features
4. Add user management within organizations
5. Configure email templates in Supabase

## Troubleshooting

### Auth not working?
- Verify your Supabase URL and anon key in `.env.local`
- Check that the database tables are created
- Ensure RLS policies are enabled

### Can't access dashboard?
- Make sure you're signed in
- Check browser console for errors
- Verify middleware is configured correctly

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [shadcn/ui Documentation](https://ui.shadcn.com)
