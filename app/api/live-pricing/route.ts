import { NextResponse } from "next/server";
import { getAuthedContext } from "@/lib/api";
import { getFundData, getHoldings } from "@/lib/sheets";
import { getLiveFundDeltaFast } from "@/lib/extendedPortfolio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The 3-5s ticker's data source: ONE tiny JSON with the fund-wide live
// delta — everything the client needs to retick every headline figure
// (each consumer scales the fund delta to its own slice). Deliberately
// NOT a page refresh: the sheet and Supabase are never touched beyond
// their existing 60s snapshots, and the quote batch sits behind a 5s
// shared cache, so a family of pollers costs one Yahoo call per window.
export async function GET() {
  const ctx = await getAuthedContext();
  if (ctx instanceof NextResponse) return ctx;

  const [holdings, fund] = await Promise.all([
    getHoldings().catch(() => []),
    getFundData().catch(() => null),
  ]);
  const delta = await getLiveFundDeltaFast(holdings);

  return NextResponse.json(
    {
      deltaAzn: delta?.deltaAzn ?? 0,
      mode: delta?.mode ?? null,
      asOfMs: delta?.asOfMs ?? null,
      /** Whether a live read actually exists — false means "hold what you
       *  have", never "snap to zero". */
      ok: delta != null,
      unitPriceAzn: fund?.unitPrice ?? null,
      totalUnits: fund?.totalUnits ?? null,
      t: Date.now(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
