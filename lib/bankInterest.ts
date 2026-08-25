import type { SupabaseClient } from "@supabase/supabase-js";

// Günlük faiz: every İsmayılBank deposit accrues interest daily at 10%
// EFFECTIVE annual (the daily rate is the 365th root, so daily crediting
// compounds to exactly the advertised figure). Day D's interest becomes
// balance on day D+1, landing in the same "Hesablaşılmamış" bucket the
// daily rewards use — an append-only ledger İsmayıl settles into the
// Sheet deposit. Accrual is lazy: the /bank render calls the RPC, which
// back-fills any missed days (bounded) and is idempotent per (user, day).

import { DAILY_DEPOSIT_EFFECTIVE_ANNUAL_PCT } from "@/lib/bankTermsData";

export const INTEREST_EFFECTIVE_ANNUAL_PCT = DAILY_DEPOSIT_EFFECTIVE_ANNUAL_PCT;

export type BankInterestState = {
  /** false when the table isn't reachable (migration not applied, outage) —
   *  interest simply doesn't show then. */
  available: boolean;
  /** Accrued but not yet settled into the Sheet deposit — the part that
   *  counts into the displayed İsmayılBank deposit balance. */
  unsettledAzn: number;
  /** Lifetime interest accrued (settled + unsettled). */
  totalAzn: number;
  /** The amount credited today — yesterday's earning, which became balance
   *  this morning. 0 before the first accrual. */
  creditedTodayAzn: number;
};

const UNAVAILABLE: BankInterestState = {
  available: false,
  unsettledAzn: 0,
  totalAzn: 0,
  creditedTodayAzn: 0,
};

// Baku is fixed UTC+4 (no DST) — manual math, no Intl (hydration rule).
function bakuDayIso(now = new Date()): string {
  return new Date(now.getTime() + 4 * 3_600_000).toISOString().slice(0, 10);
}

function prevDayIso(iso: string): string {
  return new Date(new Date(`${iso}T00:00:00Z`).getTime() - 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/**
 * Accrue any missing days for the signed-in holder, then return their
 * interest state. The RPC needs the Sheet deposit as its base — Postgres
 * can't see the Sheet — and both the call and the read happen in one round
 * so today's credit shows on the very render that created it.
 *
 * Only ON-DEMAND deposits accrue: a Sheet row with a term product (rate /
 * müddət filled) is governed by its own contract, so the caller uses
 * getBankInterestState instead — the differentiation lives entirely in
 * whether İsmayıl fills those cells.
 */
export async function accrueAndGetBankInterest(
  supabase: SupabaseClient,
  userId: string,
  holderName: string,
  depositAzn: number,
  now = new Date(),
): Promise<BankInterestState> {
  const { error: accrueError } = await supabase.rpc("accrue_bank_interest", {
    p_holder_name: holderName,
    p_deposit_azn: Math.max(0, depositAzn),
  });
  if (accrueError) {
    console.error("[bank-interest] accrual failed:", accrueError);
    // Fall through: stale rows still beat no rows.
  }
  return getBankInterestState(supabase, userId, now);
}

/**
 * Read-only state — for term-deposit accounts, which accrue nothing new
 * but may still hold (and must still display) unsettled interest from
 * their on-demand days.
 */
export async function getBankInterestState(
  supabase: SupabaseClient,
  userId: string,
  now = new Date(),
): Promise<BankInterestState> {
  const { data, error } = await supabase
    .from("bank_interest_accruals")
    .select("accrual_date, amount_azn, settled_at")
    .eq("user_id", userId)
    .order("accrual_date", { ascending: false })
    .limit(800);
  if (error) {
    console.error("[bank-interest] state fetch failed:", error);
    return UNAVAILABLE;
  }

  // Credited today = earned yesterday (Baku).
  const yesterday = prevDayIso(bakuDayIso(now));
  let unsettledAzn = 0;
  let totalAzn = 0;
  let creditedTodayAzn = 0;
  for (const row of data ?? []) {
    const amount = Number(row.amount_azn);
    if (!Number.isFinite(amount)) continue;
    totalAzn += amount;
    if (row.settled_at == null) unsettledAzn += amount;
    if (String(row.accrual_date) === yesterday) creditedTodayAzn = amount;
  }

  return { available: true, unsettledAzn, totalAzn, creditedTodayAzn };
}

export type BankUnsettledTotals = {
  /** false when the RPC was unreachable — the bank-wide view then simply
   *  omits the ledger lines rather than showing zeros as truth. */
  available: boolean;
  interestUnsettledAzn: number;
  interestSettledAzn: number;
  rewardsUnsettledAzn: number;
  rewardsSettledAzn: number;
};

const TOTALS_UNAVAILABLE: BankUnsettledTotals = {
  available: false,
  interestUnsettledAzn: 0,
  interestSettledAzn: 0,
  rewardsUnsettledAzn: 0,
  rewardsSettledAzn: 0,
};

/**
 * Bank-wide unsettled/settled sums of BOTH daily ledgers, visible to every
 * signed-in holder via the aggregate-only bank_unsettled_totals RPC (the
 * per-row RLS is own-or-admin, so raw reads can't produce these).
 */
export async function getBankUnsettledTotals(
  supabase: SupabaseClient,
): Promise<BankUnsettledTotals> {
  const { data, error } = await supabase.rpc("bank_unsettled_totals");
  if (error || !data || typeof data !== "object") {
    if (error) console.error("[bank-interest] totals RPC failed:", error);
    return TOTALS_UNAVAILABLE;
  }
  const row = data as Record<string, unknown>;
  const num = (key: string) => {
    const n = Number(row[key]);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  return {
    available: true,
    interestUnsettledAzn: num("interest_unsettled"),
    interestSettledAzn: num("interest_settled"),
    rewardsUnsettledAzn: num("rewards_unsettled"),
    rewardsSettledAzn: num("rewards_settled"),
  };
}

export type BankInterestHolderTotal = {
  name: string;
  totalAzn: number;
  /** Not yet settled into the Sheet deposit — what İsmayıl still owes. */
  unsettledAzn: number;
  dayCount: number;
  lastAccrual: string | null;
};

/**
 * Per-holder lifetime totals for İsmayıl's settlement view. Relies on the
 * admin arm of the RLS read policy — a non-admin session only ever sees its
 * own rows here, so the aggregation degrades to a single-holder list.
 */
export async function getBankInterestTotals(
  supabase: SupabaseClient,
): Promise<BankInterestHolderTotal[]> {
  const { data, error } = await supabase
    .from("bank_interest_accruals")
    .select("holder_name, amount_azn, accrual_date, settled_at")
    .order("accrual_date", { ascending: false })
    .limit(5000);
  if (error) {
    console.error("[bank-interest] totals fetch failed:", error);
    return [];
  }
  const byName = new Map<string, BankInterestHolderTotal>();
  for (const row of data ?? []) {
    const name = String(row.holder_name || "").trim() || "—";
    const amount = Number(row.amount_azn);
    if (!Number.isFinite(amount)) continue;
    const entry =
      byName.get(name) ??
      ({
        name,
        totalAzn: 0,
        unsettledAzn: 0,
        dayCount: 0,
        lastAccrual: null,
      } as BankInterestHolderTotal);
    entry.totalAzn += amount;
    if (row.settled_at == null) entry.unsettledAzn += amount;
    entry.dayCount += 1;
    const date = String(row.accrual_date);
    if (entry.lastAccrual == null || date > entry.lastAccrual) {
      entry.lastAccrual = date;
    }
    byName.set(name, entry);
  }
  return [...byName.values()].sort((a, b) => b.unsettledAzn - a.unsettledAzn);
}
