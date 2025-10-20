import { getAuthSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { tasks } from "@trigger.dev/sdk/v3";
import { createKnowledgeBaseItem, insertKnowledgeBaseItem } from "@/lib/knowledge-base/items";

// POST - Create multiple knowledge base items at once
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { user, organizationId } = await getAuthSession();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug, id: knowledgeBaseId } = await params;

    const supabase = await createServiceClient();

    // Verify the organization slug matches the user's organization
    const { data: org } = await supabase
      .from("organisations")
      .select("id")
      .eq("slug", slug)
      .eq("id", organizationId)
      .single();

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Verify the knowledge base belongs to the organization
    const { data: kb } = await supabase
      .from("knowledge_bases")
      .select("id")
      .eq("id", knowledgeBaseId)
      .eq("organization_id", organizationId)
      .single();

    if (!kb) {
      return NextResponse.json(
        { error: "Knowledge base not found" },
        { status: 404 }
      );
    }

    const { items } = await request.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Items array is required and cannot be empty" },
        { status: 400 }
      );
    }

    const results: {
      successful: Record<string, unknown>[];
      failed: { url: string; error: string }[];
    } = {
      successful: [],
      failed: [],
    };

    // Process each item
    for (const item of items) {
      try {
        const { name, url, type = "url" } = item;

        if (!name || !url) {
          results.failed.push({
            url: url || "unknown",
            error: "Name and URL are required",
          });
          continue;
        }

        // Create item data
        const { itemData } = await createKnowledgeBaseItem({
          knowledgeBaseId,
          organizationId,
          name,
          url,
          type: type as "url",
        });

        // Insert the item into the database
        try {
          const insertedItem = await insertKnowledgeBaseItem(itemData);
          
          // Trigger background processing
          try {
            await tasks.trigger("process-item", {
              knowledgeBaseItemId: insertedItem.id,
            });
          } catch (triggerError) {
            console.error("Error triggering processing task:", triggerError);
            // Don't fail the request if trigger fails
          }
          
          results.successful.push(insertedItem);
        } catch (insertError) {
          console.error("Error creating knowledge base item:", insertError);
          results.failed.push({
            url,
            error:
              insertError instanceof Error
                ? insertError.message
                : "Failed to create item",
          });
        }
      } catch (error) {
        console.error("Error processing item:", error);
        results.failed.push({
          url: item.url || "unknown",
          error:
            error instanceof Error ? error.message : "Unknown error occurred",
        });
      }
    }

    return NextResponse.json(
      {
        message: `Added ${results.successful.length} items, ${results.failed.length} failed`,
        results,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Error in POST /api/[slug]/knowledge-bases/[id]/items/bulk:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

