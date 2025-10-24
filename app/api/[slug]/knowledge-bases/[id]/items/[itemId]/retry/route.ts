import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import { tasks } from '@trigger.dev/sdk/v3'

export const dynamic = 'force-dynamic'

// POST - Retry processing a failed knowledge base item
export async function POST(
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

    // Fetch the item to verify it exists and is in a retriable state
    const { data: item, error: fetchError } = await supabase
      .from('knowledge_base_items')
      .select('*')
      .eq('id', itemId)
      .eq('knowledge_base_id', knowledgeBaseId)
      .single()

    if (fetchError || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Check if item is in a retriable state (failed or processing for too long)
    const canRetry = item.status === 'failed' || item.status === 'processing'
    if (!canRetry) {
      return NextResponse.json(
        { error: 'Item is not in a retriable state. Only failed items can be retried.' },
        { status: 400 }
      )
    }

    // Delete existing document chunks to allow clean reprocessing
    await supabase
      .from('knowledge_base_documents')
      .delete()
      .eq('knowledge_base_item_id', itemId)

    // Reset the item status to pending
    const { error: updateError } = await supabase
      .from('knowledge_base_items')
      .update({
        status: 'pending',
        sync_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)

    if (updateError) {
      console.error('Error resetting item status:', updateError)
      return NextResponse.json({ error: 'Failed to reset item status' }, { status: 500 })
    }

    // Trigger background processing task
    try {
      await tasks.trigger('process-item', {
        knowledgeBaseItemId: itemId,
      })
    } catch (triggerError) {
      console.error('Error triggering processing task:', triggerError)
      return NextResponse.json(
        { error: 'Failed to queue item for processing' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true,
      message: 'Item queued for reprocessing' 
    }, { status: 200 })
  } catch (error) {
    console.error('Error in POST /api/[slug]/knowledge-bases/[id]/items/[itemId]/retry:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

