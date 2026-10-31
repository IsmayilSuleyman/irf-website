import { isPaymentPaid, simplifyText } from "@/lib/bankShared";
import type { BankAccount, BankWideAggregate } from "@/lib/bank";
import type { BondFundingSeries } from "@/lib/bonds";
import type { BondObligations } from "@/lib/liquidityProjection";
import { DAILY_DEPOSIT_EFFECTIVE_ANNUAL_PCT } from "@/lib/bankTermsData";

// Təsisçi rejimi — pure, client-safe math. With founder mode on, the
// principal's own money stops being a customer's: his Sheet deposit row is
// CAPITAL he put into the bank (no daily interest to himself, no deposit
// obligation), the bonds he bought from his own primary issue are treasury
// paper (no coupon or nominal owed to an outsider), and his daily-ledger
// rows are internal. Everything else — every other depositor, borrower and
// bondholder — stays exactly as the bank-wide view always showed it.
//
// The split is done BEFORE computeBankWide / computeBondObligations run,
// by rewriting their inputs, so those functions stay untouched and the
// aggregate they return is the outsider-only bank. The founder's side is
// carried alongside in FounderPosition and folded back in here.

export type FounderBondUnits = {
  seriesName: string;
  /** Effective units the founder holds (primary + P2P buys − P2P sells). */
  units: number;
  /** Cash the bank received from the founder's own primary buys. */
  proceedsAzn: number;
  faceValueAzn: number;
};

export type FounderPosition = {
  /** false when the Supabase side of the split (bonds, daily ledgers)
   *  could not be resolved — the deposit split still applies. */
  available: boolean;
  name: string;
  /** The founder's Sheet deposit row — his capital in the bank. */
  depositAzn: number;
  bondUnits: FounderBondUnits[];
  bondProceedsAzn: number;
  bondNominalAzn: number;
  unsettledInterestAzn: number;
  settledInterestAzn: number;
  unsettledRewardsAzn: number;
  settledRewardsAzn: number;
};

const norm = (s: string) =>
  simplifyText(s).trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");

export const isSameHolder = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && norm(a) === norm(b);

/**
 * Strip the founder's deposit (and any term cells) off his Sheet row so
 * computeBankWide neither counts it as a deposit nor promises it a bonus.
 * A loan on the same row stays — borrowing from your own bank is still a
 * loan the bank's cash is out on.
 */
export function splitFounderAccounts(
  accounts: BankAccount[],
  founderName: string,
): { accounts: BankAccount[]; founderDepositAzn: number } {
  let founderDepositAzn = 0;
  const out = accounts.map((a) => {
    if (!isSameHolder(a.name, founderName)) return a;
    founderDepositAzn += Math.max(0, a.depositedAzn);
    return {
      ...a,
      depositedAzn: 0,
      annualRatePct: null,
      termMonths: null,
      maturityBonusAzn: null,
      maturityDate: null,
      netAzn: -a.outstandingLoanAzn,
    };
  });
  return { accounts: out, founderDepositAzn };
}

/**
 * The outsider-only bond book: settled units and proceeds net of what the
 * founder holds / paid himself. Coupons and nominal on treasury units are
 * internal, so the obligation and projection math must only see the rest.
 */
export function splitFounderBonds(
  breakdown: BondFundingSeries[],
  founderUnits: FounderBondUnits[],
): BondFundingSeries[] {
  return breakdown.map((s) => {
    const own = founderUnits.find((u) => u.seriesName === s.name);
    if (!own) return s;
    const units = Math.max(0, s.settledUnits - own.units);
    return {
      ...s,
      settledUnits: units,
      proceedsAzn: Math.max(0, s.proceedsAzn - own.proceedsAzn),
    };
  });
}

export type LoanInterestAhead = {
  name: string;
  outstandingAzn: number;
  /** Σ unpaid scheduled installments − outstanding principal, floored at 0. */
  interestAheadAzn: number;
  unpaidInstallments: number;
};

/**
 * Interest the bank will EARN on its loan book, read off the Sheet the
 * only way it can be: what the schedule still asks for beyond the
 * principal. A loan whose unpaid installments sum exactly to the balance
 * is interest-free (the 0% family tier); one that asks for more carries
 * the difference as income ahead. Rows without a schedule yield 0 — there
 * is nothing to read.
 */
export function computeLoanInterestAhead(accounts: BankAccount[]): LoanInterestAhead[] {
  const out: LoanInterestAhead[] = [];
  for (const acc of accounts) {
    if (acc.outstandingLoanAzn <= 0) continue;
    let unpaidSum = 0;
    let unpaidCount = 0;
    for (const item of acc.paymentSchedule) {
      if (item.amountAzn == null || item.amountAzn <= 0) continue;
      if (isPaymentPaid(item.status)) continue;
      unpaidSum += item.amountAzn;
      unpaidCount += 1;
    }
    out.push({
      name: acc.name,
      outstandingAzn: acc.outstandingLoanAzn,
      interestAheadAzn:
        unpaidCount > 0 ? Math.max(0, unpaidSum - acc.outstandingLoanAzn) : 0,
      unpaidInstallments: unpaidCount,
    });
  }
  return out.sort((a, b) => b.interestAheadAzn - a.interestAheadAzn);
}

export type FounderView = {
  name: string;
  /** Deposit row + cash paid for own primary bonds — money he put in. */
  capitalAzn: number;
  founderDepositAzn: number;
  founderBondProceedsAzn: number;
  founderBondNominalAzn: number;
  founderBondUnits: number;
  /** Deposits + bond proceeds from everyone else. */
  outsiderFundingAzn: number;
  outsiderDepositsAzn: number;
  outsiderBondFundingAzn: number;
  loansAzn: number;
  /** All funding (capital included) − loans: the cash in the bank's hands. */
  freeLiquidityAzn: number;
  assetReserveAzn: number;
  /** Every ₼ of interest promised to outsiders, standing today. */
  promisedInterestAzn: number;
  pendingBonusAzn: number;
  unsettledLedgerAzn: number;
  couponsRemainingAzn: number;
  /** Outsider nominal owed beyond the cash they paid (issue discount). */
  bondDiscountAzn: number;
  /** Interest the loan book will still bring in, per the schedules. */
  loanInterestAheadAzn: number;
  loans: LoanInterestAhead[];
  /** capital − promised interest − bond discount: the bank's equity today. */
  equityAzn: number;
  /** equity + the loan interest still to come. */
  equityAfterIncomeAzn: number;
  /** Run-rate: what the bank pays outsiders per month at today's book. */
  monthlyExpenseAzn: number;
  monthlyDailyDepositInterestAzn: number;
  monthlyTermInterestAzn: number;
  monthlyCouponAzn: number;
  /** Run-rate: average monthly interest the schedules bring in. */
  monthlyIncomeAzn: number;
  monthlyMarginAzn: number;
  /** Internal coupons the bank "pays" the founder on treasury bonds. */
  ownMonthlyCouponAzn: number;
  /** Daily-ledger rows the founder accrued to himself before founder mode. */
  ownUnsettledAzn: number;
};

const DAILY_MONTHLY_RATE = Math.pow(1 + DAILY_DEPOSIT_EFFECTIVE_ANNUAL_PCT / 100, 1 / 12) - 1;

/**
 * The bank through its owner's eyes. `aggregate` and `bondObligations`
 * must already be the outsider-only figures (inputs rewritten through the
 * split helpers above); `allBonds` is the unsplit breakdown so the
 * founder's own coupon run-rate can be shown as the internal line it is.
 */
export function computeFounderView(input: {
  position: FounderPosition;
  aggregate: BankWideAggregate;
  bondObligations: BondObligations;
  outsiderBonds: BondFundingSeries[];
  allBonds: BondFundingSeries[];
  accounts: BankAccount[];
}): FounderView {
  const { position: p, aggregate: a, bondObligations: ob } = input;

  const founderBondUnits = p.bondUnits.reduce((s, u) => s + u.units, 0);
  const capitalAzn = p.depositAzn + p.bondProceedsAzn;
  const outsiderFundingAzn = a.totalDepositsAzn + a.bondFundingAzn;
  const loansAzn = a.totalLoansAzn;
  const freeLiquidityAzn = outsiderFundingAzn + capitalAzn - loansAzn;

  const unsettledLedgerAzn = a.unsettledInterestAzn + a.unsettledRewardsAzn;
  const outsiderProceeds = input.outsiderBonds.reduce((s, b) => s + b.proceedsAzn, 0);
  const bondDiscountAzn = Math.max(0, ob.nominalAzn - outsiderProceeds);
  const promisedInterestAzn =
    a.totalPendingBonusAzn + unsettledLedgerAzn + ob.couponsRemainingAzn;

  const loans = computeLoanInterestAhead(input.accounts);
  const loanInterestAheadAzn = loans.reduce((s, l) => s + l.interestAheadAzn, 0);

  const equityAzn = capitalAzn - promisedInterestAzn - bondDiscountAzn;

  // Expense run-rate: on-demand deposits compound daily to 10% effective a
  // year (a twelfth of that per month); term deposits carry the aggregate's
  // own monthly accrual; coupons average to annual/12 per series.
  let monthlyDailyDepositInterestAzn = 0;
  for (const d of a.depositors) {
    const isTerm =
      (d.termMonths != null && d.termMonths > 0) ||
      (d.annualRatePct != null && d.annualRatePct > 0);
    if (!isTerm) monthlyDailyDepositInterestAzn += d.depositedAzn * DAILY_MONTHLY_RATE;
  }
  const monthlyTermInterestAzn = a.totalMonthlyInterestAzn;
  const monthlyCouponAzn = input.outsiderBonds.reduce(
    (s, b) => s + (b.settledUnits * b.faceValueAzn * b.couponRatePct) / 100 / 12,
    0,
  );
  const ownMonthlyCouponAzn = p.bondUnits.reduce(
    (s, u) => {
      const series = input.allBonds.find((b) => b.name === u.seriesName);
      if (!series) return s;
      return s + (u.units * u.faceValueAzn * series.couponRatePct) / 100 / 12;
    },
    0,
  );
  const monthlyExpenseAzn =
    monthlyDailyDepositInterestAzn + monthlyTermInterestAzn + monthlyCouponAzn;
  const monthlyIncomeAzn = loans.reduce(
    (s, l) => s + (l.unpaidInstallments > 0 ? l.interestAheadAzn / l.unpaidInstallments : 0),
    0,
  );

  return {
    name: p.name,
    capitalAzn,
    founderDepositAzn: p.depositAzn,
    founderBondProceedsAzn: p.bondProceedsAzn,
    founderBondNominalAzn: p.bondNominalAzn,
    founderBondUnits,
    outsiderFundingAzn,
    outsiderDepositsAzn: a.totalDepositsAzn,
    outsiderBondFundingAzn: a.bondFundingAzn,
    loansAzn,
    freeLiquidityAzn,
    assetReserveAzn: a.assetReserveAzn,
    promisedInterestAzn,
    pendingBonusAzn: a.totalPendingBonusAzn,
    unsettledLedgerAzn,
    couponsRemainingAzn: ob.couponsRemainingAzn,
    bondDiscountAzn,
    loanInterestAheadAzn,
    loans,
    equityAzn,
    equityAfterIncomeAzn: equityAzn + loanInterestAheadAzn,
    monthlyExpenseAzn,
    monthlyDailyDepositInterestAzn,
    monthlyTermInterestAzn,
    monthlyCouponAzn,
    monthlyIncomeAzn,
    monthlyMarginAzn: monthlyIncomeAzn - monthlyExpenseAzn,
    ownMonthlyCouponAzn,
    ownUnsettledAzn: p.unsettledInterestAzn + p.unsettledRewardsAzn,
  };
}
