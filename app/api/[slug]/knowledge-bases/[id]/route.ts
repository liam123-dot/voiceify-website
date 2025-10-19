import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import ragie from '@/lib/ragie/client'

export const dynamic = 'force-dynamic'

// GET - Get a single knowledge base
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

    // Fetch the knowledge base
    const { data: knowledgeBase, error } = await supabase
      .from('knowledge_bases')
      .select('id, name, description, created_at, updated_at')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single()

    if (error || !knowledgeBase) {
      console.error('Error fetching knowledge base:', error)
      return NextResponse.json({ error: 'Knowledge base not found' }, { status: 404 })
    }

    return NextResponse.json({ knowledgeBase })
  } catch (error) {
    console.error('Error in GET /api/[slug]/knowledge-bases/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete a knowledge base
// This will also delete all items, agent associations, and Ragie documents
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug } = await params
    const { user, organizationId } = await getAuthSession(slug)
    const { id } = await params

    if (!user || !organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createServiceClient()

    // Verify the knowledge base belongs to the user's organization
    const { data: knowledgeBase, error: kbError } = await supabase
      .from('knowledge_bases')
      .select('id, organization_id')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single()

    if (kbError || !knowledgeBase) {
      return NextResponse.json({ error: 'Knowledge base not found' }, { status: 404 })
    }

    // Fetch all items to delete from Ragie and Supabase storage
    const { data: items, error: itemsError } = await supabase
      .from('knowledge_base_items')
      .select('id, ragie_document_id, file_location, type')
      .eq('knowledge_base_id', id)

    if (itemsError) {
      console.error('Error fetching knowledge base items:', itemsError)
      return NextResponse.json({ error: 'Failed to fetch items for deletion' }, { status: 500 })
    }

    // Delete items from Ragie (if they have ragie_document_id)
    const deletePromises = (items || []).map(async (item) => {
      try {
        if (item.ragie_document_id) {
          await ragie.documents.delete({
            documentId: item.ragie_document_id,
            partition: organizationId,
          })
        }

        // Delete file from Supabase storage if it's a file type
        if (item.type === 'file' && item.file_location) {
          await supabase.storage
            .from('knowledge-base-files')
            .remove([item.file_location])
        }
      } catch (error) {
        console.error(`Error deleting item ${item.id}:`, error)
        // Continue with deletion even if Ragie/storage deletion fails
      }
    })

    await Promise.allSettled(deletePromises)

    // Delete agent associations (CASCADE will handle this, but being explicit)
    await supabase
      .from('agent_knowledge_bases')
      .delete()
      .eq('knowledge_base_id', id)

    // Delete the knowledge base (CASCADE will delete items in database)
    const { error: deleteError } = await supabase
      .from('knowledge_bases')
      .delete()
      .eq('id', id)
      .eq('organization_id', organizationId)

    if (deleteError) {
      console.error('Error deleting knowledge base:', deleteError)
      return NextResponse.json({ error: 'Failed to delete knowledge base' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error in DELETE /api/[slug]/knowledge-bases/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

