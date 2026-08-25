import { describe, expect, it } from "vitest";
import { computeBankWide, type BankAccount } from "@/lib/bank";
import { computeBondObligations } from "@/lib/liquidityProjection";
import { computeBankHealth, computeDepositCoverage } from "@/lib/bankHealth";
import type { BondFundingSeries } from "@/lib/bonds";

const TODAY = new Date("2026-08-25T12:00:00Z");

function mkAccount(over: Partial<BankAccount> = {}): BankAccount {
  return {
    annualRatePct: null,
    depositedAzn: 0,
    maturityBonusAzn: null,
    maturityDate: null,
    monthlyPaymentAzn: null,
    name: "Test",
    netAzn: 0,
    nextPaymentDate: null,
    outstandingLoanAzn: 0,
    paymentSchedule: [],
    termMonths: null,
    updatedAt: null,
    ...over,
  };
}

function mkSeries(over: Partial<BondFundingSeries> = {}): BondFundingSeries {
  return {
    name: "S1",
    settledUnits: 10,
    proceedsAzn: 500,
    faceValueAzn: 50,
    couponRatePct: 12,
    couponPeriodMonths: 3,
    issueDate: "2026-01-15",
    maturityDate: "2027-01-15",
    ...over,
  };
}

describe("computeBondObligations", () => {
  it("counts only FUTURE coupons plus the nominal", () => {
    // Quarterly coupons: apr 15, jul 15, oct 15, jan 15 '27. Today is
    // aug 25 — two remain. Each = 10 × 50 × 12% × 3/12 = 15 ₼.
    const r = computeBondObligations([mkSeries()], TODAY);
    expect(r.couponsRemainingAzn).toBeCloseTo(30, 10);
    expect(r.nominalAzn).toBe(500);
    expect(r.totalAzn).toBeCloseTo(530, 10);
  });

  it("a matured or unsold series owes nothing", () => {
    expect(
      computeBondObligations([mkSeries({ maturityDate: "2026-05-01" })], TODAY)
        .totalAzn,
    ).toBe(0);
    expect(
      computeBondObligations([mkSeries({ settledUnits: 0 })], TODAY).totalAzn,
    ).toBe(0);
  });
});

describe("computeBankWide — overdue bucket", () => {
  it("surfaces unpaid past installments instead of silently dropping them", () => {
    const acc = mkAccount({
      name: "Borclu",
      outstandingLoanAzn: 300,
      paymentSchedule: [
        { date: "2026-08-10", amountAzn: 50, label: null, status: null }, // late
        { date: "2026-08-20", amountAzn: 50, label: null, status: "Ödənildi" }, // paid
        { date: "2026-09-05", amountAzn: 50, label: null, status: null }, // upcoming
      ],
    });
    const agg = computeBankWide([acc], TODAY);
    expect(agg.overdue.items).toHaveLength(1);
    expect(agg.overdue.items[0]).toMatchObject({
      name: "Borclu",
      amountAzn: 50,
      daysOverdue: 15,
    });
    expect(agg.overdue.totalAzn).toBe(50);
    // The late row must NOT double as expected inflow; the paid and the
    // upcoming rows keep their old behavior.
    expect(agg.next30dInflow.items).toHaveLength(2);
    expect(agg.next30dInflow.totalAzn).toBe(50);
  });

  it("treats a past nextPaymentDate as overdue when no schedule exists (90-day cap)", () => {
    const late = mkAccount({
      outstandingLoanAzn: 200,
      monthlyPaymentAzn: 40,
      nextPaymentDate: "2026-08-01",
    });
    const stale = mkAccount({
      outstandingLoanAzn: 200,
      monthlyPaymentAzn: 40,
      nextPaymentDate: "2025-01-01",
    });
    expect(computeBankWide([late], TODAY).overdue.items).toHaveLength(1);
    expect(computeBankWide([stale], TODAY).overdue.items).toHaveLength(0);
  });
});

describe("computeBankWide — deposit obligations", () => {
  it("folds principal, term bonuses and the unsettled daily ledgers together", () => {
    const acc = mkAccount({
      depositedAzn: 1000,
      maturityBonusAzn: 60,
      termMonths: 6,
      maturityDate: "2026-12-01",
    });
    const agg = computeBankWide([acc], TODAY, 0, 0, {
      unsettledInterestAzn: 2.5,
      unsettledRewardsAzn: 0.5,
      settledInterestAzn: 1,
      settledRewardsAzn: 0.3,
    });
    expect(agg.depositObligationsAzn).toBeCloseTo(1000 + 60 + 2.5 + 0.5, 10);
    expect(agg.settledInterestAzn).toBe(1);
    expect(agg.settledRewardsAzn).toBe(0.3);
  });
});

describe("computeDepositCoverage", () => {
  it("backing = free liquidity + the principal's live stake", () => {
    const cov = computeDepositCoverage({
      depositObligationsAzn: 1000,
      netLiquidityAzn: 600,
      principalStakeAzn: 1400,
    });
    expect(cov.ratio).toBeCloseTo(2, 10);
    expect(cov.minOnly).toBe(false);
    expect(cov.backingAzn).toBe(2000);
  });

  it("degrades to a liquidity-only FLOOR when the stake is unavailable", () => {
    const cov = computeDepositCoverage({
      depositObligationsAzn: 1000,
      netLiquidityAzn: 600,
      principalStakeAzn: null,
    });
    expect(cov.ratio).toBeCloseTo(0.6, 10);
    expect(cov.minOnly).toBe(true);
  });

  it("no obligations → no ratio", () => {
    expect(
      computeDepositCoverage({
        depositObligationsAzn: 0,
        netLiquidityAzn: 100,
        principalStakeAzn: 50,
      }).ratio,
    ).toBeNull();
  });
});

describe("computeBankHealth", () => {
  const strongCoverage = computeDepositCoverage({
    depositObligationsAzn: 1000,
    netLiquidityAzn: 800,
    principalStakeAzn: 1200,
  });

  it("all signals green → Sağlam", () => {
    const h = computeBankHealth({
      liquidityPct: 70,
      overdueCount: 0,
      overdueTotalAzn: 0,
      projectionMinAzn: 120,
      coverage: strongCoverage,
    });
    expect(h.level).toBe("saglam");
    expect(h.reasons.every((r) => r.tone === "good")).toBe(true);
  });

  it("overdue payments demote to Diqqət, never straight to Gərgin", () => {
    const h = computeBankHealth({
      liquidityPct: 70,
      overdueCount: 2,
      overdueTotalAzn: 90,
      projectionMinAzn: 120,
      coverage: strongCoverage,
    });
    expect(h.level).toBe("diqqet");
  });

  it("a projection that dips below zero is Gərgin", () => {
    const h = computeBankHealth({
      liquidityPct: 70,
      overdueCount: 0,
      overdueTotalAzn: 0,
      projectionMinAzn: -40,
      coverage: strongCoverage,
    });
    expect(h.level).toBe("gergin");
  });

  it("true under-coverage is Gərgin, but a sub-1 FLOOR (stake unavailable) only warns", () => {
    const real = computeBankHealth({
      liquidityPct: 70,
      overdueCount: 0,
      overdueTotalAzn: 0,
      projectionMinAzn: 100,
      coverage: computeDepositCoverage({
        depositObligationsAzn: 1000,
        netLiquidityAzn: 300,
        principalStakeAzn: 400,
      }),
    });
    expect(real.level).toBe("gergin");

    const floor = computeBankHealth({
      liquidityPct: 70,
      overdueCount: 0,
      overdueTotalAzn: 0,
      projectionMinAzn: 100,
      coverage: computeDepositCoverage({
        depositObligationsAzn: 1000,
        netLiquidityAzn: 300,
        principalStakeAzn: null,
      }),
    });
    expect(floor.level).toBe("diqqet");
  });

  it("unavailable inputs contribute no reason — a Sheets outage is not a bad verdict", () => {
    const h = computeBankHealth({
      liquidityPct: null,
      overdueCount: 0,
      overdueTotalAzn: 0,
      projectionMinAzn: null,
      coverage: null,
    });
    expect(h.level).toBe("saglam");
    expect(h.reasons).toHaveLength(1); // only the overdue "yoxdur" line
  });
});
