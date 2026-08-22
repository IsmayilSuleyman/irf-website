import { NextResponse } from "next/server";
import { getTickerHistory } from "@/lib/marketTicker";

// The tile panel's 5-year history, fetched on first expand — public market
// data, kept OUT of the dashboard's RSC payload (~80KB across six
// instruments). Server side rides the 6h closes cache; the CDN header lets
// repeat expands within an hour skip the function entirely.

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key") ?? "";
  const history = await getTickerHistory(key);
  return NextResponse.json(history, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=21600",
    },
  });
}
