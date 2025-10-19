import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import ragie from '@/lib/ragie/client'

export const dynamic = 'force-dynamic'

// DELETE - Delete a knowledge base item
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string; itemId: string }> }
) {
  try {
    const { user, organizationId } = await getAuthSession()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { slug, id: knowledgeBaseId, itemId } = await params

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

    // Fetch the item to get ragie_document_id and file_location
    const { data: item, error: fetchError } = await supabase
      .from('knowledge_base_items')
      .select('ragie_document_id, file_location, type')
      .eq('id', itemId)
      .eq('knowledge_base_id', knowledgeBaseId)
      .single()

    if (fetchError || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Delete from Ragie if document was indexed
    if (item.ragie_document_id) {
      try {
        await ragie.documents.delete({ 
          documentId: item.ragie_document_id,
          partition: organizationId
        })
      } catch (error) {
        console.error('Error deleting document from Ragie:', error)
        // Continue with deletion even if Ragie delete fails
      }
    }

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

