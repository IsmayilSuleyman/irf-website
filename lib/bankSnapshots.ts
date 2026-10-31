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

export type BankDailyRow = {
  date: string; // YYYY-MM-DD
  depositsAzn: number;
  loansAzn: number;
  bondFundingAzn: number;
  assetReserveAzn: number;
  netLiquidityAzn: number;
  unsettledInterestAzn: number;
  unsettledRewardsAzn: number;
};

/**
 * Every column of the last `days` snapshots, oldest-first — the money-flow
 * ledger reads the Sheet-side movements (deposits in, loans out) off the
 * day-over-day deltas. [] when the table is unreachable.
 */
export async function getBankDailyRows(
  supabase: SupabaseClient,
  days = 400,
): Promise<BankDailyRow[]> {
  const { data, error } = await supabase
    .from("bank_daily_snapshots")
    .select(
      "snapshot_date, deposits_azn, loans_azn, bond_funding_azn, asset_reserve_azn, net_liquidity_azn, unsettled_interest_azn, unsettled_rewards_azn",
    )
    .order("snapshot_date", { ascending: false })
    .limit(days);
  if (error) {
    console.error("[bank-snapshots] fetch failed:", error);
    return [];
  }
  const out: BankDailyRow[] = [];
  for (const row of (data ?? []).reverse()) {
    const r = {
      date: String(row.snapshot_date),
      depositsAzn: Number(row.deposits_azn),
      loansAzn: Number(row.loans_azn),
      bondFundingAzn: Number(row.bond_funding_azn),
      assetReserveAzn: Number(row.asset_reserve_azn),
      netLiquidityAzn: Number(row.net_liquidity_azn),
      unsettledInterestAzn: Number(row.unsettled_interest_azn),
      unsettledRewardsAzn: Number(row.unsettled_rewards_azn),
    };
    if (![r.depositsAzn, r.loansAzn, r.netLiquidityAzn].every(Number.isFinite)) continue;
    out.push(r);
  }
  return out;
}

/** The sparkline series over already-fetched rows (last `days`). */
export function toBankTrendSeries(
  rows: BankDailyRow[],
  days = 90,
): BankTrendSeries | null {
  const tail = rows.slice(-days);
  if (tail.length < 2) return null;
  return {
    dates: tail.map((r) => r.date),
    deposits: tail.map((r) => r.depositsAzn),
    loans: tail.map((r) => r.loansAzn),
    net: tail.map((r) => r.netLiquidityAzn),
  };
}

/**
 * The last `days` daily snapshots, oldest-first. Null when fewer than two
 * rows exist (nothing to draw yet) or the table is unreachable — callers
 * simply skip the sparklines then.
 */
export async function getBankDailySeries(
  supabase: SupabaseClient,
  days = 90,
): Promise<BankTrendSeries | null> {
  return toBankTrendSeries(await getBankDailyRows(supabase, days), days);
}
