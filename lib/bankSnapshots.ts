import type { SupabaseClient } from "@supabase/supabase-js";

// Reader for bank_daily_snapshots — the nightly pg_cron record of the
// bank's headline figures (see /api/record-bank-daily). Feeds the trend
// sparklines under the Ümumbank stat tiles; the series grows one point per
// Baku day whether or not anyone opens the site.

export type BankTrendSeries = {
  dates: string[]; // YYYY-MM-DD, ascending
  deposits: number[];
  loans: number[];
  net: number[];
};

/**
 * The last `days` daily snapshots, oldest-first. Null when fewer than two
 * rows exist (nothing to draw yet) or the table is unreachable — callers
 * simply skip the sparklines then.
 */
export async function getBankDailySeries(
  supabase: SupabaseClient,
  days = 90,
): Promise<BankTrendSeries | null> {
  const { data, error } = await supabase
    .from("bank_daily_snapshots")
    .select("snapshot_date, deposits_azn, loans_azn, net_liquidity_azn")
    .order("snapshot_date", { ascending: false })
    .limit(days);
  if (error) {
    console.error("[bank-snapshots] fetch failed:", error);
    return null;
  }
  const rows = (data ?? []).reverse();
  if (rows.length < 2) return null;

  const series: BankTrendSeries = { dates: [], deposits: [], loans: [], net: [] };
  for (const row of rows) {
    const dep = Number(row.deposits_azn);
    const loan = Number(row.loans_azn);
    const net = Number(row.net_liquidity_azn);
    if (![dep, loan, net].every(Number.isFinite)) continue;
    series.dates.push(String(row.snapshot_date));
    series.deposits.push(dep);
    series.loans.push(loan);
    series.net.push(net);
  }
  return series.dates.length >= 2 ? series : null;
}
