import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// PATCH - Update a knowledge base item (for status updates)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string; itemId: string }> }
) {
  try {
    const { slug, id: knowledgeBaseId, itemId } = await params
    const body = await request.json()
    const { user, organizationId } = await getAuthSession(slug)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    // Update the item
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }

    if (body.status) {
      updates.status = body.status
    }

    if (body.sync_error !== undefined) {
      updates.sync_error = body.sync_error
    }

    const { data: item, error: updateError } = await supabase
      .from('knowledge_base_items')
      .update(updates)
      .eq('id', itemId)
      .eq('knowledge_base_id', knowledgeBaseId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating knowledge base item:', updateError)
      return NextResponse.json({ error: 'Failed to update item' }, { status: 500 })
    }

    return NextResponse.json({ item }, { status: 200 })
  } catch (error) {
    console.error('Error in PATCH /api/[slug]/knowledge-bases/[id]/items/[itemId]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete a knowledge base item
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string; itemId: string }> }
) {
  try {
    const { slug, id: knowledgeBaseId, itemId } = await params
    const { user, organizationId } = await getAuthSession(slug)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    // Fetch the item to get file_location
    const { data: item, error: fetchError } = await supabase
      .from('knowledge_base_items')
      .select('file_location, type')
      .eq('id', itemId)
      .eq('knowledge_base_id', knowledgeBaseId)
      .single()

    if (fetchError || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Delete associated document embeddings (CASCADE will handle this)
    // knowledge_base_documents has ON DELETE CASCADE from knowledge_base_items

    // Delete file from storage if it's a file type
    if (item.type === 'file' && item.file_location) {
      try {
        await supabase.storage
          .from('knowledge-base-files')
          .remove([item.file_location])
      } catch (error) {
        console.error('Error deleting file from storage:', error)
        // Continue with deletion even if storage delete fails
      }
    }

    // Delete the item from the database
    const { error: deleteError } = await supabase
      .from('knowledge_base_items')
      .delete()
      .eq('id', itemId)
      .eq('knowledge_base_id', knowledgeBaseId)

    if (deleteError) {
      console.error('Error deleting knowledge base item:', deleteError)
      return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error in DELETE /api/[slug]/knowledge-bases/[id]/items/[itemId]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

