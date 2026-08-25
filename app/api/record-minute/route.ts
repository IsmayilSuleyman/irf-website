import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAssetTransactions, getFundData, getHoldings } from "@/lib/sheets";
import { getLiveFundDeltaFast } from "@/lib/extendedPortfolio";
import {
  buildAssetHolderSummaries,
  getAssetQuotes,
} from "@/lib/personalAssets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const r2 = (n: number) => Math.round(n * 100) / 100;
const r4 = (n: number) => Math.round(n * 10_000) / 10_000;

// Minutely snapshot recorder, called by the Supabase pg_cron job — every
// minute, visitors or none. Records the LIVE figures the dashboard shows
// (pay price, fund total, each holder's İRF value plus their ETF book) so
// the daily/weekly/monthly charts have a real series to draw. The bearer
// the cron sends is forwarded to the RPC, which checks it against the
// Vault secret — the database is the single gatekeeper.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const [fund, holdings, assetTxs] = await Promise.all([
    getFundData().catch(() => null),
    getHoldings().catch(() => []),
    getAssetTransactions().catch(() => []),
  ]);
  if (!fund || fund.totalUnits <= 0 || fund.unitPrice <= 0) {
    // A Sheets hiccup skips this minute; the cron tries again in 60s.
    return NextResponse.json({ error: "sheet unavailable" }, { status: 502 });
  }

  const delta = await getLiveFundDeltaFast(holdings);
  const deltaAzn = delta?.deltaAzn ?? 0;
  const unitPriceLive = fund.unitPrice + deltaAzn / fund.totalUnits;

  // Each holder's ETF book at the same live quotes, keyed by their sheet
  // name — so a personal minute series can match the dashboard headline
  // (İRF slice + vault book), not just the İRF half.
  const assetSymbols = [...new Set(assetTxs.map((t) => t.symbol))];
  const assetQuotes =
    assetSymbols.length > 0 ? await getAssetQuotes(assetSymbols) : {};
  const bookByName = new Map(
    buildAssetHolderSummaries(assetTxs, assetQuotes).map((s) => [
      s.name.trim().toLocaleLowerCase("az-AZ"),
      s.valueAzn,
    ]),
  );

  const holders = fund.holders.map((h) => ({
    n: h.name,
    u: h.units,
    v: r2(h.units * unitPriceLive),
    a: r2(bookByName.get(h.name.trim().toLocaleLowerCase("az-AZ")) ?? 0),
  }));

  const { data, error } = await supabase.rpc("record_minute_snapshot", {
    p_secret: bearer,
    p_unit_price_azn: r4(unitPriceLive),
    p_fund_total_azn: r2(fund.totalCapital + deltaAzn),
    p_delta_azn: r2(deltaAzn),
    p_mode: delta?.mode ?? null,
    p_holders: holders,
  });
  if (error) {
    const status = error.code === "42501" ? 401 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ ok: true, ...(data as object) });
}
