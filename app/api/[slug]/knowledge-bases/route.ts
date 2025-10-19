import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET - List all knowledge bases for an organization
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { user, organizationId } = await getAuthSession()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { slug } = await params

    const supabase = await createServiceClient()

    // Verify the organization slug matches the user's organization
    const { data: org } = await supabase
      .from('organisations')
      .select('id')
      .eq('slug', slug)
      .eq('id', organizationId)
      .single()

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Fetch knowledge bases for the organization
    const { data: knowledgeBases, error } = await supabase
      .from('knowledge_bases')
      .select('id, name, description, created_at, updated_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching knowledge bases:', error)
      return NextResponse.json({ error: 'Failed to fetch knowledge bases' }, { status: 500 })
    }

    return NextResponse.json({ knowledgeBases: knowledgeBases || [] })
  } catch (error) {
    console.error('Error in GET /api/[slug]/knowledge-bases:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create a new knowledge base
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { user, organizationId } = await getAuthSession()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { slug } = await params
    const body = await request.json()
    const { name, description } = body

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const supabase = await createServiceClient()

    // Verify the organization slug matches the user's organization
    const { data: org } = await supabase
      .from('organisations')
      .select('id')
      .eq('slug', slug)
      .eq('id', organizationId)
      .single()

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Create the knowledge base
    const { data: knowledgeBase, error } = await supabase
      .from('knowledge_bases')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        organization_id: organizationId,
      })
      .select('id, name, description, created_at, updated_at')
      .single()

    if (error) {
      console.error('Error creating knowledge base:', error)
      return NextResponse.json({ error: 'Failed to create knowledge base' }, { status: 500 })
    }

    return NextResponse.json({ knowledgeBase }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/[slug]/knowledge-bases:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

