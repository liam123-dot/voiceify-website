import { logger, schemaTask } from "@trigger.dev/sdk/v3";
import z from "zod";

export const testFirecrawl = schemaTask({
  id: "test-firecrawl",
  schema: z.object({
    url: z.string(),
  }),
  machine: "medium-2x",
  run: async (payload) => {
    logger.log("Testing Firecrawl with URL", { url: payload.url });

    // Fetch with Firecrawl API
    const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: payload.url,
        formats: ["markdown"],
      }),
    });
    console.log('response', response);
  console.log(response.body);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Firecrawl API error ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    
    logger.log("Firecrawl response received", { 
      success: result.success,
      hasMarkdown: !!result.data?.markdown,
      textLength: result.data?.markdown?.length 
    });

    return {
      success: true,
      markdown: result.data?.markdown,
      metadata: result.data?.metadata,
    };
  },
});

