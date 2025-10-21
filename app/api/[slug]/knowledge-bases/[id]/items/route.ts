import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import { tasks } from '@trigger.dev/sdk/v3'
import { createKnowledgeBaseItem, insertKnowledgeBaseItem } from '@/lib/knowledge-base/items'

export const dynamic = 'force-dynamic'

// GET - List all items in a knowledge base
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { user, organizationId } = await getAuthSession()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { slug, id } = await params

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

    // Verify the knowledge base belongs to the organization
    const { data: kb } = await supabase
      .from('knowledge_bases')
      .select('id')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single()

    if (!kb) {
      return NextResponse.json({ error: 'Knowledge base not found' }, { status: 404 })
    }

    // Fetch knowledge base items
    const { data: items, error } = await supabase
      .from('knowledge_base_items')
      .select('*')
      .eq('knowledge_base_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching knowledge base items:', error)
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 })
    }

    return NextResponse.json({ items: items || [] })
  } catch (error) {
    console.error('Error in GET /api/[slug]/knowledge-bases/[id]/items:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create a new knowledge base item
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { user, organizationId } = await getAuthSession()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { slug, id: knowledgeBaseId } = await params

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

    // Verify the knowledge base belongs to the organization
    const { data: kb } = await supabase
      .from('knowledge_bases')
      .select('id')
      .eq('id', knowledgeBaseId)
      .eq('organization_id', organizationId)
      .single()

    if (!kb) {
      return NextResponse.json({ error: 'Knowledge base not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const type = formData.get('type') as string
    const name = formData.get('name') as string

    if (!type || !name) {
      return NextResponse.json({ error: 'Type and name are required' }, { status: 400 })
    }

    // Validate type-specific required fields
    if (type === 'url') {
      const url = formData.get('url') as string
      if (!url) {
        return NextResponse.json({ error: 'URL is required for url type' }, { status: 400 })
      }
    } else if (type === 'text') {
      const textContent = formData.get('text_content') as string
      if (!textContent) {
        return NextResponse.json({ error: 'Text content is required for text type' }, { status: 400 })
      }
    } else if (type === 'file') {
      const file = formData.get('file') as File
      if (!file) {
        return NextResponse.json({ error: 'File is required for file type' }, { status: 400 })
      }
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    // Get optional chunking config
    const chunkSize = formData.get('chunk_size') 
      ? parseInt(formData.get('chunk_size') as string, 10) 
      : undefined
    const chunkOverlap = formData.get('chunk_overlap')
      ? parseInt(formData.get('chunk_overlap') as string, 10)
      : undefined

    // Create item data
    const { itemData } = await createKnowledgeBaseItem({
      knowledgeBaseId,
      organizationId,
      name,
      url: formData.get('url') as string | undefined,
      text_content: formData.get('text_content') as string | undefined,
      file: formData.get('file') as File | undefined,
      type: type as 'url' | 'text' | 'file',
      chunkSize,
      chunkOverlap,
    })

    // Insert the item into the database
    const item = await insertKnowledgeBaseItem(itemData)

    // Trigger background processing task
    try {
      await tasks.trigger('test-firecrawl-1', {
        knowledgeBaseItemId: item.id,
      })
    } catch (triggerError) {
      console.error('Error triggering processing task:', triggerError)
      // Don't fail the request if trigger fails - item is created
      // User can manually retry processing later
    }

    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/[slug]/knowledge-bases/[id]/items:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

