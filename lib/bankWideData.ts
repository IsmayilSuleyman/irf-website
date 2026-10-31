import type { SupabaseClient } from "@supabase/supabase-js";
import { computeBankWide, getBankAccounts, type BankAccount, type BankWideAggregate } from "@/lib/bank";
import { getBondFlowRows, getBondFundingAzn, getBondFundingBreakdown, type BondFundingSeries } from "@/lib/bonds";
import {
  computeBondObligations,
  computeLiquidityProjection,
  type BondObligations,
  type LiquidityProjectionPoint,
} from "@/lib/liquidityProjection";
import { computeBankHealth, type BankHealth } from "@/lib/bankHealth";
import { getBankDailyRows, toBankTrendSeries, type BankTrendSeries } from "@/lib/bankSnapshots";
import { getAssetTransactions } from "@/lib/sheets";
import { computeAssetReserveAzn } from "@/lib/personalAssets";
import { USD_TO_AZN } from "@/lib/portfolio";
import { getBankInterestRows, getBankUnsettledTotals, type BankUnsettledTotals } from "@/lib/bankInterest";
import { getDailyRewardRows } from "@/lib/dailyReward";
import { FUND_PRINCIPAL_NAME } from "@/lib/holdings";
import { buildMoneyFlow, type FlowEvent } from "@/lib/bankFlows";
import {
  computeFounderView,
  splitFounderAccounts,
  splitFounderBonds,
  type FounderPosition,
  type FounderView,
} from "@/lib/bankFounder";
import { getFounderMode, getFounderPosition } from "@/lib/founderMode";

// One loader for everything the Ümumbank baxışı renders — and, in founder
// mode, for the founder hero on İsmayıl's own /bank. Fetches every source
// in one parallel round, applies the founder split to the INPUTS when the
// mode is on, then runs the existing pure math untouched.

export type BankWideData = {
  now: Date;
  founderMode: boolean;
  /** Set only in founder mode: the founder's side of the split. */
  founder: FounderView | null;
  founderPosition: FounderPosition | null;
  aggregate: BankWideAggregate;
  projection: LiquidityProjectionPoint[];
  bondObligations: BondObligations;
  health: BankHealth;
  trend: BankTrendSeries | null;
  unsettledAvailable: boolean;
  flows: FlowEvent[];
  /** True when the Supabase ledgers were read under a non-admin session
   *  (own rows only) — the ledger is then a partial view by design. */
  flowsPartial: boolean;
  /** Raw Sheet rows — the personal page needs the founder's own row. */
  accounts: BankAccount[];
};

const TOTALS_UNAVAILABLE: BankUnsettledTotals = {
  available: false,
  interestUnsettledAzn: 0,
  interestSettledAzn: 0,
  rewardsUnsettledAzn: 0,
  rewardsSettledAzn: 0,
};

export async function loadBankWideData(
  supabase: SupabaseClient | null,
  isAdmin: boolean,
  now = new Date(),
): Promise<BankWideData> {
  const [
    accounts,
    bondFundingAll,
    bondBreakdownAll,
    assetTxs,
    unsettledTotals,
    snapshotRows,
    bondRows,
    interestRows,
    rewardRows,
    founderMode,
  ] = await Promise.all([
    getBankAccounts(),
    getBondFundingAzn(),
    getBondFundingBreakdown(),
    getAssetTransactions(),
    supabase ? getBankUnsettledTotals(supabase) : Promise.resolve(TOTALS_UNAVAILABLE),
    supabase ? getBankDailyRows(supabase) : Promise.resolve([]),
    getBondFlowRows(),
    supabase ? getBankInterestRows(supabase) : Promise.resolve([]),
    supabase ? getDailyRewardRows(supabase) : Promise.resolve([]),
    getFounderMode(),
  ]);

  // Founder split: rewrite the inputs, never the math.
  let aggAccounts = accounts;
  let bondFundingAzn = bondFundingAll;
  let bondBreakdown: BondFundingSeries[] = bondBreakdownAll;
  let unsettled = {
    unsettledInterestAzn: unsettledTotals.interestUnsettledAzn,
    unsettledRewardsAzn: unsettledTotals.rewardsUnsettledAzn,
    settledInterestAzn: unsettledTotals.interestSettledAzn,
    settledRewardsAzn: unsettledTotals.rewardsSettledAzn,
  };
  let founderPosition: FounderPosition | null = null;
  if (founderMode) {
    const split = splitFounderAccounts(accounts, FUND_PRINCIPAL_NAME);
    aggAccounts = split.accounts;
    founderPosition = await getFounderPosition(
      supabase,
      FUND_PRINCIPAL_NAME,
      split.founderDepositAzn,
      isAdmin,
    );
    bondBreakdown = splitFounderBonds(bondBreakdownAll, founderPosition.bondUnits);
    bondFundingAzn = Math.max(0, bondFundingAll - founderPosition.bondProceedsAzn);
    unsettled = {
      unsettledInterestAzn: Math.max(0, unsettled.unsettledInterestAzn - founderPosition.unsettledInterestAzn),
      unsettledRewardsAzn: Math.max(0, unsettled.unsettledRewardsAzn - founderPosition.unsettledRewardsAzn),
      settledInterestAzn: Math.max(0, unsettled.settledInterestAzn - founderPosition.settledInterestAzn),
      settledRewardsAzn: Math.max(0, unsettled.settledRewardsAzn - founderPosition.settledRewardsAzn),
    };
  }

  const assetReserveAzn = computeAssetReserveAzn(assetTxs);
  const aggregate = computeBankWide(aggAccounts, now, bondFundingAzn, assetReserveAzn, unsettled);
  const bondObligations = computeBondObligations(bondBreakdown, now);
  // In founder mode the founder's capital is lendable cash too — the walk
  // starts from everything the bank holds, not just outsiders' money.
  const startLiquidity =
    founderMode && founderPosition
      ? aggregate.netLiquidityAzn + founderPosition.depositAzn + founderPosition.bondProceedsAzn
      : aggregate.netLiquidityAzn;
  const projection = computeLiquidityProjection(aggAccounts, bondBreakdown, startLiquidity, now);
  const projectionMinAzn =
    projection.length >= 2 ? Math.min(...projection.map((p) => p.valueAzn)) : null;
  const liquidityPct =
    founderMode && founderPosition
      ? (() => {
          const funding = aggregate.totalFundingAzn + founderPosition.depositAzn + founderPosition.bondProceedsAzn;
          return funding > 0 ? ((funding - aggregate.totalLoansAzn) / funding) * 100 : null;
        })()
      : aggregate.liquidityPct;
  const health = computeBankHealth({
    liquidityPct,
    overdueCount: aggregate.overdue.items.length,
    overdueTotalAzn: aggregate.overdue.totalAzn,
    projectionMinAzn,
  });

  const founder =
    founderMode && founderPosition
      ? computeFounderView({
          position: founderPosition,
          aggregate,
          bondObligations,
          outsiderBonds: bondBreakdown,
          allBonds: bondBreakdownAll,
          accounts,
        })
      : null;

  const flows = buildMoneyFlow({
    today: now,
    snapshots: snapshotRows.map((r) => ({
      date: r.date,
      depositsAzn: r.depositsAzn,
      loansAzn: r.loansAzn,
    })),
    live:
      accounts.length > 0
        ? {
            depositsAzn: accounts.reduce((s, a) => s + a.depositedAzn, 0),
            loansAzn: accounts.reduce((s, a) => s + a.outstandingLoanAzn, 0),
          }
        : null,
    accounts,
    bondTrades: bondRows.trades,
    bondPayments: bondRows.payments,
    interest: interestRows,
    rewards: rewardRows,
    assets: assetTxs.map((t) => ({
      holderName: t.holderName,
      date: t.date,
      symbol: t.symbol,
      units: t.units,
      paidAzn: t.paidAzn ?? Math.abs(t.units) * t.priceUsd * USD_TO_AZN,
    })),
    founderName: founderMode ? FUND_PRINCIPAL_NAME : null,
  });

  return {
    now,
    founderMode,
    founder,
    founderPosition,
    aggregate,
    projection,
    bondObligations,
    health,
    trend: toBankTrendSeries(snapshotRows),
    unsettledAvailable: unsettledTotals.available,
    flows,
    flowsPartial: !isAdmin,
    accounts,
  };
}
