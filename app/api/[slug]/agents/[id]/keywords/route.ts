import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthSession } from "@/lib/auth";

/**
 * GET /api/[slug]/agents/[id]/keywords
 * 
 * Fetch all extracted keywords from all knowledge base items
 * associated with this agent's knowledge bases.
 * 
 * Returns a unique set of keywords from all items.
 * 
 * POST /api/[slug]/agents/[id]/keywords
 * 
 * Update the agent's STT keywords configuration.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id: agentId } = await params;
    
    // Get auth session
    let authResult;
    try {
      authResult = await getAuthSession(slug);
    } catch (authError) {
      console.error("Auth error:", authError);
      return NextResponse.json(
        { error: "Authentication failed" },
        { status: 401 }
      );
    }
    
    const { user, organizationId } = authResult;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createServiceClient();

    // Verify agent exists and belongs to organization
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("id")
      .eq("id", agentId)
      .eq("organization_id", organizationId)
      .single();

    if (agentError || !agent) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    // Fetch all knowledge bases associated with this agent
    const { data: agentKnowledgeBases, error: agentKBError } = await supabase
      .from("agent_knowledge_bases")
      .select("knowledge_base_id")
      .eq("agent_id", agentId);

    if (agentKBError) {
      throw new Error(`Failed to fetch agent knowledge bases: ${agentKBError.message}`);
    }

    if (!agentKnowledgeBases || agentKnowledgeBases.length === 0) {
      return NextResponse.json({
        keywords: [],
        message: "No knowledge bases found for this agent",
        knowledgeBaseCount: 0,
        itemCount: 0,
      });
    }

    const knowledgeBaseIds = agentKnowledgeBases.map((akb) => akb.knowledge_base_id);

    // Fetch all items from those knowledge bases that have extracted keywords
    const { data: items, error: itemsError } = await supabase
      .from("knowledge_base_items")
      .select("extracted_keywords")
      .in("knowledge_base_id", knowledgeBaseIds)
      .not("extracted_keywords", "is", null)
      .eq("keyword_extraction_status", "completed");

    if (itemsError) {
      throw new Error(`Failed to fetch items: ${itemsError.message}`);
    }

    // Aggregate all keywords into a unique set
    const keywordSet = new Set<string>();
    
    if (items && items.length > 0) {
      for (const item of items) {
        if (item.extracted_keywords && Array.isArray(item.extracted_keywords)) {
          for (const keyword of item.extracted_keywords) {
            if (keyword && typeof keyword === 'string') {
              keywordSet.add(keyword);
            }
          }
        }
      }
    }

    const uniqueKeywords = Array.from(keywordSet).sort();

    return NextResponse.json({
      keywords: uniqueKeywords,
      knowledgeBaseCount: knowledgeBaseIds.length,
      itemCount: items?.length || 0,
    });
  } catch (error) {
    console.error("Error in GET /api/[slug]/agents/[id]/keywords:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Update agent's STT keywords
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id: agentId } = await params;
    
    // Get auth session
    let authResult;
    try {
      authResult = await getAuthSession(slug);
    } catch (authError) {
      console.error("Auth error:", authError);
      return NextResponse.json(
        { error: "Authentication failed" },
        { status: 401 }
      );
    }
    
    const { user, organizationId } = authResult;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const { keywords } = body;

    if (!Array.isArray(keywords)) {
      return NextResponse.json(
        { error: "Keywords must be an array" },
        { status: 400 }
      );
    }

    // Validate all keywords are strings
    if (!keywords.every((k) => typeof k === "string")) {
      return NextResponse.json(
        { error: "All keywords must be strings" },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Verify agent exists and belongs to organization
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("id, configuration")
      .eq("id", agentId)
      .eq("organization_id", organizationId)
      .single();

    if (agentError || !agent) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    // Update agent configuration with new keywords
    const configuration = (agent.configuration as Record<string, unknown>) || {};
    configuration.keywords = keywords;

    const { error: updateError } = await supabase
      .from("agents")
      .update({ configuration })
      .eq("id", agentId);

    if (updateError) {
      throw new Error(`Failed to update agent: ${updateError.message}`);
    }

    return NextResponse.json({
      success: true,
      keywords,
    });
  } catch (error) {
    console.error("Error in POST /api/[slug]/agents/[id]/keywords:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
