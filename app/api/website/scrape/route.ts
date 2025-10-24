import { NextResponse } from "next/server";
import { extractTextFromHTML } from "@/lib/embeddings/processor";

/**
 * Fetch and extract text from a URL using Firecrawl API
 */
async function fetchTextFromURLWithFirecrawl(url: string): Promise<string> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error("Firecrawl API key not configured");
  }

  const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: url,
      formats: ["markdown"],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Firecrawl API error ${response.status}: ${errorText}`);
  }

  const result = await response.json();

  if (!result.success || !result.data?.markdown) {
    throw new Error("No content extracted from URL via Firecrawl");
  }

  return result.data.markdown;
}

/**
 * Fetch and extract text from a URL using basic fetch
 */
async function fetchTextFromURL(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; KnowledgeBaseBot/1.0)',
    },
    signal: AbortSignal.timeout(30000), // 30 second timeout
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const html = await response.text();
  const text = extractTextFromHTML(html);
  
  if (!text || text.trim().length === 0) {
    throw new Error("No text content extracted from URL");
  }

  return text;
}

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    let content: string;

    try {
      // Try Firecrawl first
      content = await fetchTextFromURLWithFirecrawl(url);
    } catch (firecrawlError) {
      console.warn('Firecrawl failed, falling back to basic fetch', { 
        error: firecrawlError,
        url 
      });
      
      // Fallback to basic fetch
      try {
        content = await fetchTextFromURL(url);
      } catch (fallbackError) {
        const errorMsg = fallbackError instanceof Error 
          ? fallbackError.message 
          : "Unknown error";
        return NextResponse.json(
          { success: false, error: `Failed to fetch URL: ${errorMsg}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true, content });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}

