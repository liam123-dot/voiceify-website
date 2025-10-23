import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { tasks } from "@trigger.dev/sdk/v3";
import { extractKbItemKeywords } from "@/src/trigger/extract-keywords";
import { getAuthSession } from "@/lib/auth";

/**
 * POST /api/[slug]/knowledge-bases/[id]/extract-keywords
 * 
 * Queue keyword extraction tasks for all items in a knowledge base
 * that haven't been processed yet or have failed.
 * 
 * Returns summary of queued items.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id: knowledgeBaseId } = await params;
    const { user, organizationId } = await getAuthSession(slug)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createServiceClient();

    // Verify organization access
    const { data: org, error: orgError } = await supabase
      .from("organisations")
      .select("id")
      .eq("id", organizationId)
      .single();

    if (orgError || !org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Verify knowledge base belongs to organization
    const { data: kb, error: kbError } = await supabase
      .from("knowledge_bases")
      .select("id, name")
      .eq("id", knowledgeBaseId)
      .eq("organization_id", organizationId)
      .single();

    if (kbError || !kb) {
      return NextResponse.json(
        { error: "Knowledge base not found" },
        { status: 404 }
      );
    }

    // Find all items that need keyword extraction
    // (status is null, pending, or failed)
    // Exclude rightmove_agent items as they have no direct content
    const { data: items, error: itemsError } = await supabase
      .from("knowledge_base_items")
      .select("id, name, keyword_extraction_status, type")
      .eq("knowledge_base_id", knowledgeBaseId)
      .is("deleted_at", null)
      .neq("type", "rightmove_agent")
      .or("keyword_extraction_status.is.null,keyword_extraction_status.eq.failed");

    if (itemsError) {
      throw new Error(`Failed to fetch items: ${itemsError.message}`);
    }

    if (!items || items.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No items need keyword extraction",
        queued: 0,
        alreadyProcessing: 0,
      });
    }

    // Update all items to 'pending' status
    const itemIds = items.map((item) => item.id);
    const { error: updateError } = await supabase
      .from("knowledge_base_items")
      .update({ keyword_extraction_status: "pending" })
      .in("id", itemIds);

    if (updateError) {
      throw new Error(`Failed to update items: ${updateError.message}`);
    }

    // Batch trigger the extraction tasks
    await tasks.batchTrigger<typeof extractKbItemKeywords>(
      "extract-kb-item-keywords",
      itemIds.map((id) => ({
        payload: { knowledgeBaseItemId: id },
      }))
    );

    return NextResponse.json({
      success: true,
      message: `Queued ${items.length} item(s) for keyword extraction`,
      queued: items.length,
      knowledgeBase: kb.name,
    });
  } catch (error) {
    console.error("Error in extract-keywords route:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

