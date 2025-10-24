import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthSession } from "@/lib/auth";

/**
 * GET /api/[slug]/knowledge-bases/[id]/extractions/[extractionId]
 * 
 * Get details and progress for a specific extraction
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string; extractionId: string }> }
) {
  try {
    const { slug, id: knowledgeBaseId, extractionId } = await params;
    const { user, organizationId } = await getAuthSession(slug);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createServiceClient();

    // Verify organization access to knowledge base
    const { data: kb, error: kbError } = await supabase
      .from("knowledge_bases")
      .select("id")
      .eq("id", knowledgeBaseId)
      .eq("organization_id", organizationId)
      .single();

    if (kbError || !kb) {
      return NextResponse.json({ error: "Knowledge base not found" }, { status: 404 });
    }

    // Fetch extraction
    const { data: extraction, error: extractionError } = await supabase
      .from("knowledge_base_extractions")
      .select("*")
      .eq("id", extractionId)
      .eq("knowledge_base_id", knowledgeBaseId)
      .single();

    if (extractionError || !extraction) {
      return NextResponse.json({ error: "Extraction not found" }, { status: 404 });
    }

    // Calculate counts from child items
    const { count: totalItems } = await supabase
      .from("knowledge_base_items")
      .select("*", { count: "exact", head: true })
      .eq("parent_item_id", extraction.parent_item_id)
      .eq("status", "indexed");

    const { count: completedItems } = await supabase
      .from("knowledge_base_item_extractions")
      .select("*", { count: "exact", head: true })
      .eq("extraction_id", extractionId)
      .eq("status", "completed");

    const { count: failedItems } = await supabase
      .from("knowledge_base_item_extractions")
      .select("*", { count: "exact", head: true })
      .eq("extraction_id", extractionId)
      .eq("status", "failed");

    const total = totalItems || 0;
    const processed = completedItems || 0;
    const failed = failedItems || 0;

    // Check if extraction is complete and update status if needed
    if (
      extraction.status === "processing" &&
      processed + failed >= total &&
      total > 0
    ) {
      const newStatus = failed === total ? "failed" : "completed";
      
      await supabase
        .from("knowledge_base_extractions")
        .update({
          status: newStatus,
          completed_at: new Date().toISOString(),
        })
        .eq("id", extractionId);

      extraction.status = newStatus;
      extraction.completed_at = new Date().toISOString();
    }

    return NextResponse.json({
      extraction: {
        ...extraction,
        total_items: total,
        processed_items: processed,
        failed_items: failed,
      },
    });
  } catch (error) {
    console.error("Error in extraction GET route:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/[slug]/knowledge-bases/[id]/extractions/[extractionId]
 * 
 * Delete an extraction and all its results
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string; extractionId: string }> }
) {
  try {
    const { slug, id: knowledgeBaseId, extractionId } = await params;
    const { user, organizationId } = await getAuthSession(slug);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createServiceClient();

    // Verify organization access to knowledge base
    const { data: kb, error: kbError } = await supabase
      .from("knowledge_bases")
      .select("id")
      .eq("id", knowledgeBaseId)
      .eq("organization_id", organizationId)
      .single();

    if (kbError || !kb) {
      return NextResponse.json({ error: "Knowledge base not found" }, { status: 404 });
    }

    // Delete extraction (CASCADE will delete item_extractions)
    const { error: deleteError } = await supabase
      .from("knowledge_base_extractions")
      .delete()
      .eq("id", extractionId)
      .eq("knowledge_base_id", knowledgeBaseId);

    if (deleteError) {
      return NextResponse.json(
        { error: `Failed to delete extraction: ${deleteError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Extraction deleted successfully" });
  } catch (error) {
    console.error("Error in extraction DELETE route:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

