import { createClient } from "@supabase/supabase-js";
import { getHoldings } from "@/lib/sheets";
import { buildMomentumItems, getSpyReferences } from "@/lib/momentumData";
import { DEFAULT_WEIGHTS, scoreUniverse } from "@/lib/momentum";
import { MIN_SNAPSHOT_ROWS } from "@/lib/momentumWeekData";

// Scheduled side of the weekly momentum snapshot. The render-triggered write
// in momentumWeekData.ts samples whenever the admin happens to open the
// dashboard — which makes "this week's scores" depend on login luck. This
// runner is called from the daily record-price cron on Baku Mondays (00:00
// Baku, before any trading — Friday's close), so the week is cemented at the
// same deterministic moment every time; the render write remains as a
// fallback for a missed cron.
//
// Runs with the anon key: the SECRET, not the role, is the authority. The RPC
// checks private.app_secrets 'payment_reminder_secret' — deliberately the
// same secret the reminder cron uses (one cron trust domain, nothing new to
// provision out of band).

export type SnapshotRunResult = {
  ok: boolean;
  reason?: string;
  week?: string;
  inserted?: number;
  rows?: number;
};

export async function runMomentumWeekSnapshot(
  opts: { dryRun?: boolean } = {},
): Promise<SnapshotRunResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.PAYMENT_REMINDER_SECRET;
  if (!url || !anon) {
    return { ok: false, reason: "Supabase env vars are not configured" };
  }
  if (!secret) {
    return { ok: false, reason: "PAYMENT_REMINDER_SECRET is not configured" };
  }

  const [holdings, spy] = await Promise.all([
    getHoldings(),
    getSpyReferences(),
  ]);
  // A missing SPY reference nulls relative strength for every row, shifting
  // every score — never cement a week computed that way. Same gate as the
  // render path.
  if (spy.ret13w == null) {
    return { ok: false, reason: "SPY reference missing — degraded board" };
  }

  const rows = scoreUniverse(
    buildMomentumItems(holdings, spy),
    DEFAULT_WEIGHTS,
  ).rows;
  if (rows.length < MIN_SNAPSHOT_ROWS) {
    return { ok: false, reason: `only ${rows.length} scored rows` };
  }

  const payload = rows.map((r, i) => ({
    symbol: r.symbol,
    score: r.score,
    rank: i + 1,
    closeCall: r.closeCall,
  }));
  if (opts.dryRun) return { ok: true, rows: rows.length };

  const supabase = createClient(url, anon);
  const { data, error } = await supabase.rpc("record_momentum_week_cron", {
    p_rows: payload,
    p_secret: secret,
  });
  if (error) return { ok: false, reason: error.message };

  const result = (data ?? {}) as { week?: string; inserted?: number };
  return {
    ok: true,
    week: result.week,
    inserted: result.inserted,
    rows: rows.length,
  };
}
