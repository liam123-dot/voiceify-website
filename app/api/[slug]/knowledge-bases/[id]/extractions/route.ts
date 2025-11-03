import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthSession } from "@/lib/auth";
import { tasks } from "@trigger.dev/sdk/v3";
import { extractCustomData } from "@/src/trigger/extract-custom-data";
import type { CreateExtractionRequest } from "@/types/extractions";

/**
 * POST /api/[slug]/knowledge-bases/[id]/extractions
 * 
 * Create a new custom extraction run for an estate agent's properties
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id: knowledgeBaseId } = await params;
    const { user, organizationId } = await getAuthSession(slug);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as CreateExtractionRequest & { parentItemId: string };
    console.log("body", body);
    const { name, prompt, model, parentItemId } = body;

    if (!name || !prompt || !model || !parentItemId) {
      return NextResponse.json(
        { error: "Missing required fields: name, prompt, model, parentItemId" },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Verify knowledge base belongs to organization
    const { data: kb, error: kbError } = await supabase
      .from("knowledge_bases")
      .select("id")
      .eq("id", knowledgeBaseId)
      .eq("organization_id", organizationId)
      .single();

    if (kbError || !kb) {
      return NextResponse.json({ error: "Knowledge base not found" }, { status: 404 });
    }

    // Verify parent item exists and belongs to this knowledge base
    const { data: parentItem, error: parentError } = await supabase
      .from("knowledge_base_items")
      .select("id, type")
      .eq("id", parentItemId)
      .eq("knowledge_base_id", knowledgeBaseId)
      .single();

    if (parentError || !parentItem) {
      return NextResponse.json({ error: "Parent item not found" }, { status: 404 });
    }

    if (parentItem.type !== "rightmove_agent") {
      return NextResponse.json(
        { error: "Parent item must be a rightmove_agent" },
        { status: 400 }
      );
    }

    // Fetch all child properties
    const { data: properties, error: propertiesError } = await supabase
      .from("knowledge_base_items")
      .select("id")
      .eq("parent_item_id", parentItemId)
      .eq("status", "indexed"); // Only process indexed properties

    if (propertiesError) {
      return NextResponse.json(
        { error: `Failed to fetch properties: ${propertiesError.message}` },
        { status: 500 }
      );
    }

    if (!properties || properties.length === 0) {
      return NextResponse.json(
        { error: "No indexed properties found for this estate agent" },
        { status: 400 }
      );
    }

    // Create extraction record
    const { data: extraction, error: extractionError } = await supabase
      .from("knowledge_base_extractions")
      .insert({
        knowledge_base_id: knowledgeBaseId,
        parent_item_id: parentItemId,
        name,
        prompt,
        model,
        status: "pending",
      })
      .select()
      .single();

    if (extractionError || !extraction) {
      return NextResponse.json(
        { error: `Failed to create extraction: ${extractionError?.message}` },
        { status: 500 }
      );
    }

    console.log(`Triggering ${properties.length} extraction tasks for extraction ${extraction.id}`);
    
    // Batch trigger extraction tasks for all properties
    await tasks.batchTrigger<typeof extractCustomData>(
      "extract-custom-data",
      properties.map((property) => ({
        payload: {
          extractionId: extraction.id,
          knowledgeBaseItemId: property.id,
          prompt,
          model,
        },
      }))
    );

    console.log(`Triggered ${properties.length} tasks successfully`);

    // Update status to processing
    await supabase
      .from("knowledge_base_extractions")
      .update({ status: "processing" })
      .eq("id", extraction.id);

    return NextResponse.json({
      extraction: { ...extraction, status: "processing" },
      message: `Started extraction for ${properties.length} properties`,
    });
  } catch (error) {
    console.error("Error in extractions POST route:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/[slug]/knowledge-bases/[id]/extractions
 * 
 * List all extractions for this knowledge base
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id: knowledgeBaseId } = await params;
    const { user, organizationId } = await getAuthSession(slug);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createServiceClient();

    // Verify knowledge base belongs to organization
    const { data: kb, error: kbError } = await supabase
      .from("knowledge_bases")
      .select("id")
      .eq("id", knowledgeBaseId)
      .eq("organization_id", organizationId)
      .single();

    if (kbError || !kb) {
      return NextResponse.json({ error: "Knowledge base not found" }, { status: 404 });
    }

    // Fetch all extractions, ordered by created_at desc
    const { data: extractions, error: extractionsError } = await supabase
      .from("knowledge_base_extractions")
      .select("*")
      .eq("knowledge_base_id", knowledgeBaseId)
      .order("created_at", { ascending: false });

    if (extractionsError) {
      return NextResponse.json(
        { error: `Failed to fetch extractions: ${extractionsError.message}` },
        { status: 500 }
      );
    }

    // Enrich extractions with counts and update status if needed
    const enrichedExtractions = await Promise.all(
      (extractions || []).map(async (extraction) => {
        // Calculate counts from child items
        const { count: totalItems } = await supabase
          .from("knowledge_base_items")
          .select("*", { count: "exact", head: true })
          .eq("parent_item_id", extraction.parent_item_id)
          .eq("status", "indexed");

        const { count: completedItems } = await supabase
          .from("knowledge_base_item_extractions")
          .select("*", { count: "exact", head: true })
          .eq("extraction_id", extraction.id)
          .eq("status", "completed");

        const { count: failedItems } = await supabase
          .from("knowledge_base_item_extractions")
          .select("*", { count: "exact", head: true })
          .eq("extraction_id", extraction.id)
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
            .eq("id", extraction.id);

          extraction.status = newStatus;
          extraction.completed_at = new Date().toISOString();
        }

        return {
          ...extraction,
          total_items: total,
          processed_items: processed,
          failed_items: failed,
        };
      })
    );

    return NextResponse.json({ extractions: enrichedExtractions });
  } catch (error) {
    console.error("Error in extractions GET route:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

