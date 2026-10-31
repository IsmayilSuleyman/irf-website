import { describe, expect, it } from "vitest";
import { buildMoneyFlow, summarizeMoneyFlow, type MoneyFlowInput } from "@/lib/bankFlows";
import {
  computeFounderView,
  computeLoanInterestAhead,
  splitFounderAccounts,
  splitFounderBonds,
  type FounderPosition,
} from "@/lib/bankFounder";
import { computeBankWide, type BankAccount } from "@/lib/bank";
import { computeBondObligations } from "@/lib/liquidityProjection";
import type { BondFundingSeries } from "@/lib/bonds";

const TODAY = new Date("2026-10-31T10:00:00Z");

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

function mkInput(over: Partial<MoneyFlowInput> = {}): MoneyFlowInput {
  return {
    today: TODAY,
    snapshots: [],
    live: null,
    accounts: [],
    bondTrades: [],
    bondPayments: [],
    interest: [],
    rewards: [],
    assets: [],
    ...over,
  };
}

describe("buildMoneyFlow — Sheet deltas", () => {
  it("turns a loan decrease into a named repayment when a paid installment matches", () => {
    const events = buildMoneyFlow(
      mkInput({
        snapshots: [
          { date: "2026-10-07", depositsAzn: 1525.7, loansAzn: 1609.9 },
          { date: "2026-10-08", depositsAzn: 1525.7, loansAzn: 1536.9 },
        ],
        accounts: [
          {
            name: "SEVİNC MƏMMƏDOVA",
            depositedAzn: 0,
            outstandingLoanAzn: 728,
            paymentSchedule: [
              { date: "2026-10-10", amountAzn: 73, status: "Ödənildi", label: "Oktyabr" },
            ],
          },
        ],
      }),
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      channel: "credit",
      kind: "cash",
      amountAzn: 73,
      person: "SEVİNC MƏMMƏDOVA",
      date: "2026-10-08",
    });
  });

  it("a loan increase is cash out; a deposit increase is cash in; the live delta lands on today", () => {
    const events = buildMoneyFlow(
      mkInput({
        snapshots: [
          { date: "2026-10-29", depositsAzn: 1000, loansAzn: 500 },
          { date: "2026-10-30", depositsAzn: 1000, loansAzn: 900 },
        ],
        live: { depositsAzn: 1029.56, loansAzn: 900 },
      }),
    );
    const loan = events.find((e) => e.channel === "credit")!;
    expect(loan.amountAzn).toBe(-400);
    expect(loan.label).toBe("Kredit verildi");
    const dep = events.find((e) => e.channel === "deposit")!;
    expect(dep.amountAzn).toBeCloseTo(29.56, 10);
    expect(dep.date).toBe("2026-10-31");
    // Newest first.
    expect(events[0].date).toBe("2026-10-31");
  });
});

describe("buildMoneyFlow — Supabase ledgers", () => {
  it("primary bond sales are cash in, coupons cash out, P2P a transfer; accruals are their own bucket", () => {
    const events = buildMoneyFlow(
      mkInput({
        bondTrades: [
          { id: "a", seriesName: "İB-1", buyerName: "A", sellerName: "BANK", units: 4, price: 25, counterpartyKind: "primary", settledAt: "2026-08-01T10:00:00Z" },
          { id: "b", seriesName: "İB-1", buyerName: "B", sellerName: "A", units: 1, price: 26, counterpartyKind: "p2p", settledAt: "2026-08-02T10:00:00Z" },
        ],
        bondPayments: [
          { id: "p", seriesName: "İB-1", paymentKind: "coupon", dueDate: "2026-08-31", holderName: "A", units: 3, amountAzn: 1.56, paidAt: "2026-09-05T08:00:00Z" },
        ],
        interest: [
          { holderName: "A", date: "2026-09-01", amountAzn: 0.27, settledAt: null },
          { holderName: "A", date: "2026-09-02", amountAzn: 0.27, settledAt: "2026-09-10T06:00:00Z" },
        ],
      }),
    );
    const summary = summarizeMoneyFlow(events, null);
    expect(summary.inAzn).toBe(100);
    expect(summary.outAzn).toBe(1.56);
    expect(summary.accruedAzn).toBeCloseTo(0.54, 10);
    expect(events.find((e) => e.id === "bt-b")?.kind).toBe("transfer");
    // The settlement shows up as a transfer on the settlement day.
    const settle = events.find((e) => e.id.startsWith("set-"))!;
    expect(settle.date).toBe("2026-09-10");
    expect(settle.amountAzn).toBe(0.27);
  });

  it("founder mode reclassifies the founder's own rows and keeps them out of the sums", () => {
    const events = buildMoneyFlow(
      mkInput({
        founderName: "İSMAYIL SÜLEYMAN",
        bondTrades: [
          { id: "a", seriesName: "İB-1", buyerName: "İSMAYIL SÜLEYMAN", sellerName: "İSMAYIL SÜLEYMAN", units: 4, price: 50, counterpartyKind: "primary", settledAt: "2026-08-29T10:00:00Z" },
        ],
        bondPayments: [
          { id: "p", seriesName: "İB-1", paymentKind: "coupon", dueDate: "2026-09-29", holderName: "ismayil süleyman", units: 3, amountAzn: 2.5, paidAt: "2026-09-29T08:00:00Z" },
        ],
        interest: [{ holderName: "İSMAYIL SÜLEYMAN", date: "2026-09-01", amountAzn: 0.4, settledAt: null }],
      }),
    );
    const s = summarizeMoneyFlow(events, null);
    // His primary buy is a capital injection (still cash in); the coupon
    // and the accrual are internal.
    expect(s.byChannel.founder.inAzn).toBe(200);
    expect(s.outAzn).toBe(0);
    expect(s.accruedAzn).toBe(0);
    expect(events.every((e) => e.founder)).toBe(true);
  });

  it("the period filter is inclusive of its first day", () => {
    const events = buildMoneyFlow(
      mkInput({
        rewards: [
          { holderName: "A", date: "2026-10-01", amountAzn: 0.1, settledAt: null },
          { holderName: "A", date: "2026-10-02", amountAzn: 0.1, settledAt: null },
        ],
      }),
    );
    expect(summarizeMoneyFlow(events, "2026-10-02").accruedAzn).toBe(0.1);
    expect(summarizeMoneyFlow(events, "2026-10-01").accruedAzn).toBe(0.2);
  });

  it("asset buys add paid cash to the reserve, sells release it, day-first sheet dates parse", () => {
    const events = buildMoneyFlow(
      mkInput({
        assets: [
          { holderName: "AYSEL", date: "21.10.2026", symbol: "IBIT", units: 0.12, paidAzn: 9.78 },
          { holderName: "AYSEL", date: "21.10.2026", symbol: "GLDM", units: -0.03, paidAzn: 4.71 },
        ],
      }),
    );
    expect(events.map((e) => e.amountAzn).sort()).toEqual([-4.71, 9.78]);
    expect(events[0].date).toBe("2026-10-21");
  });
});

const SERIES: BondFundingSeries[] = [
  {
    name: "İB-26003",
    settledUnits: 4,
    proceedsAzn: 200,
    faceValueAzn: 50,
    couponRatePct: 20,
    couponPeriodMonths: 1,
    issueDate: "2026-08-29",
    maturityDate: "2027-02-28",
  },
];

const POSITION: FounderPosition = {
  available: true,
  name: "İSMAYIL SÜLEYMAN",
  depositAzn: 1555.26,
  bondUnits: [{ seriesName: "İB-26003", units: 3, proceedsAzn: 200, faceValueAzn: 50 }],
  bondProceedsAzn: 200,
  bondNominalAzn: 150,
  unsettledInterestAzn: 27,
  settledInterestAzn: 0,
  unsettledRewardsAzn: 0.1,
  settledRewardsAzn: 2.1,
};

describe("founder split", () => {
  it("strips the founder's deposit (and term cells) but keeps his loan", () => {
    const { accounts, founderDepositAzn } = splitFounderAccounts(
      [
        mkAccount({ name: "ismayil  süleyman", depositedAzn: 1555.26, annualRatePct: 0, outstandingLoanAzn: 10 }),
        mkAccount({ name: "SÜBHAN ƏLİYEV", depositedAzn: 0.21 }),
      ],
      "İSMAYIL SÜLEYMAN",
    );
    expect(founderDepositAzn).toBe(1555.26);
    expect(accounts[0].depositedAzn).toBe(0);
    expect(accounts[0].outstandingLoanAzn).toBe(10);
    expect(accounts[1].depositedAzn).toBe(0.21);
  });

  it("the outsider bond book is what is left after the founder's units and proceeds", () => {
    const out = splitFounderBonds(SERIES, POSITION.bondUnits);
    expect(out[0].settledUnits).toBe(1);
    expect(out[0].proceedsAzn).toBe(0);
    // One outsider unit: 50 nominal + its remaining coupons, no founder coupons.
    const ob = computeBondObligations(out, TODAY);
    expect(ob.nominalAzn).toBe(50);
  });

  it("reads loan interest off the schedule: payments beyond the balance", () => {
    const ahead = computeLoanInterestAhead([
      mkAccount({
        name: "S",
        outstandingLoanAzn: 728,
        paymentSchedule: [
          { date: "2026-10-10", amountAzn: 73, status: "Ödənildi", label: null },
          ...Array.from({ length: 10 }, (_, i) => ({ date: `2027-0${(i % 9) + 1}-10`, amountAzn: 73, status: "Planlaşdırılır", label: null })),
          { date: "2027-08-10", amountAzn: 71, status: null, label: null },
        ],
      }),
      mkAccount({ name: "Q", outstandingLoanAzn: 100, paymentSchedule: [{ date: "2026-11-06", amountAzn: 100, status: null, label: null }] }),
    ]);
    expect(ahead[0]).toMatchObject({ name: "S", interestAheadAzn: 73, unpaidInstallments: 11 });
    expect(ahead[1].interestAheadAzn).toBe(0);
  });

  it("computeFounderView: capital, outsider funding and equity close", () => {
    const { accounts } = splitFounderAccounts(
      [
        mkAccount({ name: "İSMAYIL SÜLEYMAN", depositedAzn: 1555.26, annualRatePct: 0 }),
        mkAccount({ name: "SÜBHAN ƏLİYEV", depositedAzn: 0.21 }),
        mkAccount({ name: "QALİB", outstandingLoanAzn: 825.12 }),
      ],
      "İSMAYIL SÜLEYMAN",
    );
    const outsiderBonds = splitFounderBonds(SERIES, POSITION.bondUnits);
    const aggregate = computeBankWide(accounts, TODAY, 0, 31.74, {
      unsettledInterestAzn: 0.5,
      unsettledRewardsAzn: 0,
      settledInterestAzn: 0,
      settledRewardsAzn: 0,
    });
    const bondObligations = computeBondObligations(outsiderBonds, TODAY);
    const v = computeFounderView({
      position: POSITION,
      aggregate,
      bondObligations,
      outsiderBonds,
      allBonds: SERIES,
      accounts,
    });
    expect(v.capitalAzn).toBeCloseTo(1755.26, 10);
    expect(v.outsiderFundingAzn).toBeCloseTo(0.21, 10);
    expect(v.freeLiquidityAzn).toBeCloseTo(1755.26 + 0.21 - 825.12, 10);
    // Sübhan's 50 nominal was never paid to the bank (P2P) → a discount owed.
    expect(v.bondDiscountAzn).toBe(50);
    expect(v.promisedInterestAzn).toBeCloseTo(0.5 + bondObligations.couponsRemainingAzn, 10);
    expect(v.equityAzn).toBeCloseTo(v.capitalAzn - v.promisedInterestAzn - 50, 10);
    expect(v.ownUnsettledAzn).toBeCloseTo(27.1, 10);
    // Own coupons: 3 × 50 × 20% / 12 = 2.5 a month, internal.
    expect(v.ownMonthlyCouponAzn).toBeCloseTo(2.5, 10);
    expect(v.monthlyCouponAzn).toBeCloseTo(50 * 0.2 / 12, 10);
  });
});
