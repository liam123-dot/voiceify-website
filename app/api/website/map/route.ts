import { getAuthSession } from "@/lib/auth";
import Firecrawl, {ErrorResponse, MapResponse} from "@mendable/firecrawl-js";
import { NextResponse } from "next/server";

const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY! });

export async function POST(request: Request) {

  await getAuthSession()

  const {url} = await request.json()


  const res: MapResponse | ErrorResponse = await firecrawl.mapUrl(url);

  if (res.success) {
    return NextResponse.json(res.links);
  } else {
    return NextResponse.json({ error: res.error }, { status: 500 });
  }

}