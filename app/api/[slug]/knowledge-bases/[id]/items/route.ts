import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import ragie from '@/lib/ragie/client'
import { createKnowledgeBaseItem, insertKnowledgeBaseItem } from '@/lib/knowledge-base/items'

export const dynamic = 'force-dynamic'

// GET - List all items in a knowledge base with Ragie status check
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

    // Check Ragie status for items not in final state
    const itemsWithStatus = await Promise.all(
      (items || []).map(async (item) => {
        // Only check Ragie status if not in final state
        if (item.ragie_document_id && item.status !== 'indexed' && item.status !== 'failed') {
          try {
            const ragieDoc = await ragie.documents.get({ 
              documentId: item.ragie_document_id,
              partition: organizationId
            })
            
            const ragieStatus = ragieDoc.status
            
            // Map Ragie status to our status
            let newStatus = item.status
            if (ragieStatus === 'ready') {
              newStatus = 'indexed'
            } else if (ragieStatus === 'failed') {
              newStatus = 'failed'
            } else if (ragieStatus === 'processing' || ragieStatus === 'queued') {
              newStatus = 'processing'
            }

            // Update status in database if changed
            if (newStatus !== item.status) {
              await supabase
                .from('knowledge_base_items')
                .update({ 
                  status: newStatus,
                  ragie_indexed_at: newStatus === 'indexed' ? new Date().toISOString() : null
                })
                .eq('id', item.id)

              item.status = newStatus
            }
          } catch (error) {
            console.error(`Error checking Ragie status for item ${item.id}:`, error)
            // Don't fail the whole request if one status check fails
          }
        }

        return item
      })
    )

    return NextResponse.json({ items: itemsWithStatus })
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

    // Create item data and index with Ragie
    const { itemData } = await createKnowledgeBaseItem({
      knowledgeBaseId,
      organizationId,
      name,
      url: formData.get('url') as string | undefined,
      text_content: formData.get('text_content') as string | undefined,
      file: formData.get('file') as File | undefined,
      type: type as 'url' | 'text' | 'file',
    })

    // Insert the item into the database
    const item = await insertKnowledgeBaseItem(itemData)

    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/[slug]/knowledge-bases/[id]/items:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

