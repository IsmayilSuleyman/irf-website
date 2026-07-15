import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { refreshExtendedHours } from "@/lib/watchlistExtended";

export const runtime = "nodejs";

// Pushes Yahoo pre/after-market quotes into the Watchlist tab (columns L–Q).
// Callable two ways: with the cron bearer secret (for a scheduled job), or
// by İsmayıl's own signed-in session (manual refresh from the browser) —
// verified via the is_fund_admin RPC, mirroring the other admin surfaces.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  let allowed = Boolean(secret) && auth === `Bearer ${secret}`;

  if (!allowed) {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const { data } = await supabase.rpc("is_fund_admin");
      allowed = data === true;
    }
  }
  if (!allowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await refreshExtendedHours(true);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
