// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { tasks } from "@trigger.dev/sdk";
import { NextResponse } from "next/server";
import type { testFirecrawl } from "@/src/trigger/test-firecrawl";

//tasks.trigger also works with the edge runtime
//export const runtime = "edge";

export async function GET() {
  const handle = await tasks.trigger<typeof testFirecrawl>(
    "test-firecrawl",
    {
      // url: "https://www.connectvargroup.io/",
      url: 'https://zenflow-ai.com/'
    }
  );

  return NextResponse.json(handle);
}