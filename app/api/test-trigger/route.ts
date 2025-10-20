

// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { tasks } from "@trigger.dev/sdk";
import { NextResponse } from "next/server";

//tasks.trigger also works with the edge runtime
//export const runtime = "edge";

export async function GET() {
  const handle = await tasks.trigger(
    "process-item",
    {
        knowledgeBaseItemId: "772af63b-408a-41b3-a457-eb2e82c49e6a",
    }
  );

  return NextResponse.json(handle);
}