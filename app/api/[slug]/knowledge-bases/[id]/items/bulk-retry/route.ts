import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import { tasks } from '@trigger.dev/sdk/v3'

export const dynamic = 'force-dynamic'

// POST - Bulk retry all failed knowledge base items
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id: knowledgeBaseId } = await params
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

    // Fetch all failed items
    const { data: failedItems, error: fetchError } = await supabase
      .from('knowledge_base_items')
      .select('id')
      .eq('knowledge_base_id', knowledgeBaseId)
      .eq('status', 'failed')

    if (fetchError) {
      console.error('Error fetching failed items:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch failed items' }, { status: 500 })
    }

    if (!failedItems || failedItems.length === 0) {
      return NextResponse.json(
        { retried: 0, message: 'No failed items to retry' },
        { status: 200 }
      )
    }

    let successCount = 0
    const errors: string[] = []

    // Process each failed item
    for (const item of failedItems) {
      try {
        // Delete existing document chunks
        await supabase
          .from('knowledge_base_documents')
          .delete()
          .eq('knowledge_base_item_id', item.id)

        // Reset the item status to pending
        const { error: updateError } = await supabase
          .from('knowledge_base_items')
          .update({
            status: 'pending',
            sync_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id)

        if (updateError) {
          console.error('Error resetting item status:', updateError)
          errors.push(`Failed to reset item ${item.id}`)
          continue
        }

        // Trigger background processing task
        try {
          await tasks.trigger('process-item', {
            knowledgeBaseItemId: item.id,
          })
          successCount++
        } catch (triggerError) {
          console.error('Error triggering processing task:', triggerError)
          errors.push(`Failed to queue item ${item.id}`)
        }
      } catch (error) {
        console.error('Error processing item:', error)
        errors.push(`Failed to process item ${item.id}`)
      }
    }

    return NextResponse.json({
      retried: successCount,
      total: failedItems.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully queued ${successCount} of ${failedItems.length} items for reprocessing`
    }, { status: 200 })
  } catch (error) {
    console.error('Error in POST /api/[slug]/knowledge-bases/[id]/items/bulk-retry:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

