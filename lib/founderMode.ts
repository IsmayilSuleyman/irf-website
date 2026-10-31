import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { isSameHolder, type FounderBondUnits, type FounderPosition } from "@/lib/bankFounder";

// Server side of Təsisçi rejimi: the on/off flag (a fund_settings key, so
// it is one global truth — the founder's interest accrual must stop for
// every render, not per browser) and the founder's Supabase-side position
// (treasury bond units, own daily-ledger rows).

export const FOUNDER_MODE_KEY = "bank_founder_mode";

async function fetchFounderMode(): Promise<boolean> {
  const config = getSupabaseConfig();
  if (!config) return false;
  // fund_settings is world-readable — a plain anon client keeps this
  // cacheable like the product terms.
  const supabase = createClient(config.url, config.anonKey);
  const { data, error } = await supabase
    .from("fund_settings")
    .select("value")
    .eq("key", FOUNDER_MODE_KEY)
    .maybeSingle();
  if (error) {
    console.error("[founder-mode] fund_settings read failed:", error.message);
    return false;
  }
  return data?.value === "on";
}

/** Whether founder mode is on. Off by default; off on any read failure. */
export const getFounderMode = unstable_cache(fetchFounderMode, ["bank-founder-mode"], {
  revalidate: 30,
  tags: ["bank-founder-mode"],
});

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function emptyPosition(name: string, depositAzn: number): FounderPosition {
  return {
    available: false,
    name,
    depositAzn,
    bondUnits: [],
    bondProceedsAzn: 0,
    bondNominalAzn: 0,
    unsettledInterestAzn: 0,
    settledInterestAzn: 0,
    unsettledRewardsAzn: 0,
    settledRewardsAzn: 0,
  };
}

function finish(
  base: FounderPosition,
  bondUnits: FounderBondUnits[],
  ledger: Pick<
    FounderPosition,
    "unsettledInterestAzn" | "settledInterestAzn" | "unsettledRewardsAzn" | "settledRewardsAzn"
  >,
): FounderPosition {
  return {
    ...base,
    ...ledger,
    available: true,
    bondUnits,
    bondProceedsAzn: bondUnits.reduce((s, u) => s + u.proceedsAzn, 0),
    bondNominalAzn: bondUnits.reduce((s, u) => s + u.units * u.faceValueAzn, 0),
  };
}

/**
 * The founder's bonds and daily-ledger rows. First choice: the
 * bank_founder_position RPC (identity-free aggregate about the one person
 * who runs the bank, readable by every signed-in holder — the same trust
 * as bank_unsettled_totals). Until that migration is applied, the admin's
 * own session can read every bond trade and ledger row, so his renders
 * still resolve the split; anyone else gets the deposit-only split with
 * `available: false`, which the view says out loud.
 */
export async function getFounderPosition(
  supabase: SupabaseClient | null,
  founderName: string,
  founderDepositAzn: number,
  isAdmin: boolean,
): Promise<FounderPosition> {
  const base = emptyPosition(founderName, founderDepositAzn);
  if (!supabase) return base;

  const { data, error } = await supabase.rpc("bank_founder_position");
  if (!error && data && typeof data === "object") {
    const row = data as Record<string, unknown>;
    const units = Array.isArray(row.bond_units) ? (row.bond_units as Record<string, unknown>[]) : [];
    return finish(
      base,
      units
        .map((u) => ({
          seriesName: String(u.series_name ?? ""),
          units: num(u.units),
          proceedsAzn: num(u.proceeds_azn),
          faceValueAzn: num(u.face_value_azn),
        }))
        .filter((u) => u.units > 0 || u.proceedsAzn > 0),
      {
        unsettledInterestAzn: num(row.interest_unsettled),
        settledInterestAzn: num(row.interest_settled),
        unsettledRewardsAzn: num(row.rewards_unsettled),
        settledRewardsAzn: num(row.rewards_settled),
      },
    );
  }
  if (error) console.error("[founder-mode] bank_founder_position failed:", error.message);
  if (!isAdmin) return base;

  // Admin fallback: the raw tables, which his RLS arm reads in full.
  const [seriesRes, tradesRes, interestRes, rewardsRes] = await Promise.all([
    supabase.from("bond_series").select("id, name, face_value_azn, status"),
    supabase
      .from("bond_trades")
      .select("series_id, buyer_name, seller_name, units, price, counterparty_kind, status")
      .eq("status", "settled"),
    supabase.from("bank_interest_accruals").select("holder_name, amount_azn, settled_at"),
    supabase.from("daily_reward_claims").select("holder_name, amount_azn, settled_at"),
  ]);
  if (seriesRes.error || tradesRes.error) {
    console.error(
      "[founder-mode] fallback read failed:",
      seriesRes.error?.message ?? tradesRes.error?.message,
    );
    return base;
  }
  const series = new Map<string, { name: string; face: number }>();
  for (const s of seriesRes.data ?? []) {
    if (String(s.status) !== "active") continue;
    series.set(String(s.id), { name: String(s.name), face: num(s.face_value_azn) });
  }
  const perSeries = new Map<string, FounderBondUnits>();
  for (const t of tradesRes.data ?? []) {
    const meta = series.get(String(t.series_id));
    if (!meta) continue;
    const cur =
      perSeries.get(meta.name) ??
      ({ seriesName: meta.name, units: 0, proceedsAzn: 0, faceValueAzn: meta.face } as FounderBondUnits);
    const units = num(t.units);
    if (isSameHolder(String(t.buyer_name), founderName)) {
      cur.units += units;
      if (String(t.counterparty_kind) === "primary") cur.proceedsAzn += units * num(t.price);
    }
    if (
      String(t.counterparty_kind) === "p2p" &&
      isSameHolder(String(t.seller_name), founderName)
    ) {
      cur.units -= units;
    }
    perSeries.set(meta.name, cur);
  }
  const sumLedger = (rows: { holder_name: string; amount_azn: unknown; settled_at: string | null }[] | null) => {
    let unsettled = 0;
    let settled = 0;
    for (const r of rows ?? []) {
      if (!isSameHolder(r.holder_name, founderName)) continue;
      if (r.settled_at == null) unsettled += num(r.amount_azn);
      else settled += num(r.amount_azn);
    }
    return { unsettled, settled };
  };
  const interest = sumLedger(interestRes.data as never);
  const rewards = sumLedger(rewardsRes.data as never);
  return finish(
    base,
    [...perSeries.values()].filter((u) => u.units > 0 || u.proceedsAzn > 0),
    {
      unsettledInterestAzn: interest.unsettled,
      settledInterestAzn: interest.settled,
      unsettledRewardsAzn: rewards.unsettled,
      settledRewardsAzn: rewards.settled,
    },
  );
}
