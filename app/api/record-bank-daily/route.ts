import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getBankAccounts } from "@/lib/bank";
import { getAssetTransactions } from "@/lib/sheets";
import { computeAssetReserveAzn } from "@/lib/personalAssets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const r2 = (n: number) => Math.round(n * 100) / 100;

// Daily bank snapshot recorder, called by the Supabase pg_cron job three
// times per Baku day (the date-PK insert makes the first success win, the
// later firings are retries for free). Only the Google-Sheet side travels
// over the wire — deposits, loans, the asset reserve; bond funding and the
// unsettled ledger sums are computed inside the RPC from the database's
// own tables. The bearer is forwarded to the RPC, which checks it against
// the Vault secret — the database is the single gatekeeper.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const [accounts, assetTxs] = await Promise.all([
    getBankAccounts(),
    getAssetTransactions().catch(() => null),
  ]);
  // getBankAccounts never throws (it serves a last-good fallback), so an
  // empty list is the outage signal — recording zeros would poison the
  // trend with a fake "everyone withdrew" day. Same for the asset ledger.
  if (accounts.length === 0 || assetTxs == null) {
    return NextResponse.json({ error: "sheet unavailable" }, { status: 502 });
  }

  const depositsAzn = accounts.reduce((s, a) => s + a.depositedAzn, 0);
  const loansAzn = accounts.reduce((s, a) => s + a.outstandingLoanAzn, 0);

  const { data, error } = await supabase.rpc("record_bank_daily_snapshot", {
    p_secret: bearer,
    p_deposits_azn: r2(depositsAzn),
    p_loans_azn: r2(loansAzn),
    p_asset_reserve_azn: r2(computeAssetReserveAzn(assetTxs)),
  });
  if (error) {
    const status = error.code === "42501" ? 401 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ ok: true, ...(data as object) });
}
