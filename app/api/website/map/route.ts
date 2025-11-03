import { getAuthSession } from "@/lib/auth";
import Firecrawl, {ErrorResponse, MapResponse} from "@mendable/firecrawl-js";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY! });

export async function POST(request: Request) {

  await getAuthSession()

  const {url, knowledgeBaseId} = await request.json()

  const res: MapResponse | ErrorResponse = await firecrawl.mapUrl(url);

  if (!res.success) {
    return NextResponse.json({ error: res.error }, { status: 500 });
  }

  // Ensure we have links
  const allLinks = res.links || [];

  // If no knowledge base ID provided, return all URLs
  if (!knowledgeBaseId) {
    return NextResponse.json(allLinks);
  }

  // Filter out URLs that already exist in the knowledge base
  const supabase = await createServiceClient();
  
  const { data: existingItems } = await supabase
    .from("knowledge_base_items")
    .select("url")
    .eq("knowledge_base_id", knowledgeBaseId)
    .eq("type", "url")
    .is("deleted_at", null);

  const existingUrls = new Set(existingItems?.map(item => item.url) || []);
  
  // Filter to only new URLs
  const newUrls = allLinks.filter(link => !existingUrls.has(link));
  
  return NextResponse.json({
    urls: newUrls,
    total: allLinks.length,
    existing: allLinks.length - newUrls.length,
    new: newUrls.length
  });

}