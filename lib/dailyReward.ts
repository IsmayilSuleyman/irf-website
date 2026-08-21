import type { SupabaseClient } from "@supabase/supabase-js";

// Günlük mükafat: the claims ledger lives in Supabase
// (daily_reward_claims + the claim_daily_reward RPC — see the migration).
// This module folds a holder's claim history into the card's state:
// today's status, lifetime/this-month totals, the consecutive-day streak
// and the last-7-days strip.

export const DAILY_REWARD_AZN = 0.1;

export type DailyRewardState = {
  /** false when the table isn't reachable (migration not applied, outage) —
   *  the card simply doesn't render then. */
  available: boolean;
  claimedToday: boolean;
  totalAzn: number;
  monthAzn: number;
  /** Consecutive claimed Baku days ending today (or yesterday while today
   *  is still unclaimed, so the streak reads as "alive" until it breaks). */
  streak: number;
  /** The last 7 Baku days, ascending, for the week strip. */
  recentDays: { date: string; claimed: boolean }[];
};

const UNAVAILABLE: DailyRewardState = {
  available: false,
  claimedToday: false,
  totalAzn: 0,
  monthAzn: 0,
  streak: 0,
  recentDays: [],
};

// Baku is fixed UTC+4 (no DST) — manual math, no Intl (hydration rule).
export function bakuDayIso(now = new Date()): string {
  return new Date(now.getTime() + 4 * 3_600_000).toISOString().slice(0, 10);
}

function prevDayIso(iso: string): string {
  return new Date(new Date(`${iso}T00:00:00Z`).getTime() - 86_400_000)
    .toISOString()
    .slice(0, 10);
}

export async function getDailyRewardState(
  supabase: SupabaseClient,
  userId: string,
  now = new Date(),
): Promise<DailyRewardState> {
  // Explicit user filter even though RLS scopes non-admin reads: the admin's
  // policy sees EVERYONE's rows (settlement), and his own card must not.
  const { data, error } = await supabase
    .from("daily_reward_claims")
    .select("claim_date, amount_azn")
    .eq("user_id", userId)
    .order("claim_date", { ascending: false })
    .limit(400);
  if (error) {
    console.error("[daily-reward] state fetch failed:", error);
    return UNAVAILABLE;
  }

  const today = bakuDayIso(now);
  const claimed = new Set<string>();
  let totalAzn = 0;
  let monthAzn = 0;
  const monthPrefix = today.slice(0, 7);
  for (const row of data ?? []) {
    const date = String(row.claim_date);
    const amount = Number(row.amount_azn);
    if (!Number.isFinite(amount)) continue;
    claimed.add(date);
    totalAzn += amount;
    if (date.startsWith(monthPrefix)) monthAzn += amount;
  }

  const claimedToday = claimed.has(today);
  let streak = 0;
  let cursor = claimedToday ? today : prevDayIso(today);
  while (claimed.has(cursor)) {
    streak += 1;
    cursor = prevDayIso(cursor);
  }

  const recentDays: { date: string; claimed: boolean }[] = [];
  let day = today;
  for (let i = 0; i < 7; i++) {
    recentDays.unshift({ date: day, claimed: claimed.has(day) });
    day = prevDayIso(day);
  }

  return { available: true, claimedToday, totalAzn, monthAzn, streak, recentDays };
}

export type DailyRewardHolderTotal = {
  name: string;
  totalAzn: number;
  claimCount: number;
  lastClaim: string | null;
};

/**
 * Per-holder lifetime totals for İsmayıl's settlement view. Relies on the
 * admin arm of the RLS read policy — a non-admin session only ever sees its
 * own rows here, so the aggregation degrades to a single-holder list.
 */
export async function getDailyRewardTotals(
  supabase: SupabaseClient,
): Promise<DailyRewardHolderTotal[]> {
  const { data, error } = await supabase
    .from("daily_reward_claims")
    .select("holder_name, amount_azn, claim_date")
    .order("claim_date", { ascending: false })
    .limit(5000);
  if (error) {
    console.error("[daily-reward] totals fetch failed:", error);
    return [];
  }
  const byName = new Map<string, DailyRewardHolderTotal>();
  for (const row of data ?? []) {
    const name = String(row.holder_name || "").trim() || "—";
    const amount = Number(row.amount_azn);
    if (!Number.isFinite(amount)) continue;
    const entry =
      byName.get(name) ??
      ({ name, totalAzn: 0, claimCount: 0, lastClaim: null } as DailyRewardHolderTotal);
    entry.totalAzn += amount;
    entry.claimCount += 1;
    const date = String(row.claim_date);
    if (entry.lastClaim == null || date > entry.lastClaim) entry.lastClaim = date;
    byName.set(name, entry);
  }
  return [...byName.values()].sort((a, b) => b.totalAzn - a.totalAzn);
}
