import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthSession } from "@/lib/auth";
import type { AggregatedResults, ExtractionResult } from "@/types/extractions";

/**
 * GET /api/[slug]/knowledge-bases/[id]/extractions/[extractionId]/results
 * 
 * Fetch all results with aggregation for an extraction
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

    // Verify extraction exists
    const { data: extraction, error: extractionError } = await supabase
      .from("knowledge_base_extractions")
      .select("id")
      .eq("id", extractionId)
      .eq("knowledge_base_id", knowledgeBaseId)
      .single();

    if (extractionError || !extraction) {
      return NextResponse.json({ error: "Extraction not found" }, { status: 404 });
    }

    // Fetch all item extraction results with property details
    const { data: results, error: resultsError } = await supabase
      .from("knowledge_base_item_extractions")
      .select(`
        *,
        knowledge_base_items!fk_item_extractions_item(
          id,
          name,
          metadata
        )
      `)
      .eq("extraction_id", extractionId)
      .order("created_at", { ascending: true });

    if (resultsError) {
      return NextResponse.json(
        { error: `Failed to fetch results: ${resultsError.message}` },
        { status: 500 }
      );
    }

    // Type for database results with joined data
    interface ResultWithItem {
      id: string;
      extraction_id: string;
      knowledge_base_item_id: string;
      extracted_data: string[] | Record<string, unknown>;
      status: 'completed' | 'failed';
      error_message: string | null;
      created_at: string;
      knowledge_base_items: {
        id: string;
        name: string;
        metadata: Record<string, unknown> | null;
      };
    }

    // Aggregate results
    const uniqueValues: Record<string, number> = {};
    const byProperty: AggregatedResults["byProperty"] = [];

    (results || []).forEach((result: ResultWithItem) => {
      const extractedData = result.extracted_data;
      
      // Add to byProperty
      byProperty.push({
        propertyId: result.knowledge_base_item_id,
        propertyName: result.knowledge_base_items.name,
        extractedData,
      });

      // Count unique values for aggregation
      if (Array.isArray(extractedData)) {
        extractedData.forEach((value) => {
          const valueStr = String(value);
          uniqueValues[valueStr] = (uniqueValues[valueStr] || 0) + 1;
        });
      }
    });

    const aggregated: AggregatedResults = {
      uniqueValues,
      byProperty,
    };

    const typedResults: ExtractionResult[] = (results || []).map((r: ResultWithItem) => ({
      id: r.id,
      extraction_id: r.extraction_id,
      knowledge_base_item_id: r.knowledge_base_item_id,
      extracted_data: r.extracted_data,
      status: r.status,
      error_message: r.error_message,
      created_at: r.created_at,
    }));

    console.log("typedResults", typedResults);

    return NextResponse.json({
      results: typedResults,
      aggregated,
    });
  } catch (error) {
    console.error("Error in extraction results route:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

