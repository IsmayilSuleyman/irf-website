import { azTitleCase, isPaymentPaid, type BankAccount } from "@/lib/bank";
import type { BondFundingSeries } from "@/lib/bonds";

// Projected bank liquidity: starting from today's net liquidity, walk every
// KNOWN future cash event and accumulate. Pure function over already-fetched
// data (caller passes `today`), mirroring computeBankWide's style.
//
// Events counted (scheduled, committed flows only — overdue/unscheduled
// amounts are deliberately excluded, the bank can't plan on late payers):
//   + unpaid loan installments on their schedule dates (or, for accounts
//     without a schedule, the monthly payment repeated until the outstanding
//     balance is exhausted);
//   − deposit principal + maturity interest on the deposit's maturity date
//     (assumes the depositor withdraws at term end — the conservative case);
//   − bond coupons on their schedule dates (settled units only);
//   − bond face-value redemption on the series' maturity date.

export type LiquidityEvent = {
  date: string; // YYYY-MM-DD
  amountAzn: number; // signed: + inflow, − outflow
  label: string;
};

export type LiquidityProjectionPoint = {
  date: string; // YYYY-MM-DD
  valueAzn: number; // projected net liquidity after this day's events
  events: LiquidityEvent[]; // what happened on this date (empty for "today")
};

function toIsoUtc(d: Date): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

// Postgres-compatible month add: clamps to the target month's end
// (Jan 31 + 1 month = Feb 28) — keeps coupon dates identical to the DB's.
function addMonthsIso(iso: string, months: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const target = new Date(Date.UTC(y, mo + months, 1));
  const daysInMonth = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(d, daysInMonth)),
  )
    .toISOString()
    .slice(0, 10);
}

// Loose ISO check: schedule cells can hold anything, only project real dates.
const isIsoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s.trim());

export function computeLiquidityProjection(
  accounts: BankAccount[],
  bondSeries: BondFundingSeries[],
  startNetLiquidityAzn: number,
  today: Date,
): LiquidityProjectionPoint[] {
  const todayIso = toIsoUtc(today);
  const events: LiquidityEvent[] = [];

  for (const acc of accounts) {
    const name = azTitleCase(acc.name);

    // Loan repayments in.
    if (acc.paymentSchedule.length > 0) {
      for (const item of acc.paymentSchedule) {
        if (item.amountAzn == null || item.amountAzn <= 0) continue;
        if (isPaymentPaid(item.status)) continue;
        const date = item.date.trim();
        if (!isIsoDate(date) || date < todayIso) continue;
        events.push({
          date,
          amountAzn: item.amountAzn,
          label: `Kredit qaytarımı — ${name}`,
        });
      }
    } else if (
      acc.outstandingLoanAzn > 0 &&
      acc.monthlyPaymentAzn != null &&
      acc.monthlyPaymentAzn > 0 &&
      acc.nextPaymentDate &&
      isIsoDate(acc.nextPaymentDate)
    ) {
      // No schedule cell: synthesize monthly installments until the balance
      // is exhausted (mirrors the 30-day fallback in computeBankWide).
      let remaining = acc.outstandingLoanAzn;
      let date: string | null = acc.nextPaymentDate.trim();
      for (let i = 0; i < 120 && remaining > 0 && date; i += 1) {
        const pay = Math.min(acc.monthlyPaymentAzn, remaining);
        if (date >= todayIso) {
          events.push({ date, amountAzn: pay, label: `Kredit qaytarımı — ${name}` });
        }
        remaining -= pay;
        date = addMonthsIso(date, 1);
      }
    }

    // Deposit withdrawal at maturity: principal + earned interest out.
    if (acc.depositedAzn > 0 && acc.maturityDate && isIsoDate(acc.maturityDate)) {
      const date = acc.maturityDate.trim();
      if (date >= todayIso) {
        const bonus =
          acc.maturityBonusAzn ??
          (acc.annualRatePct != null && acc.termMonths != null && acc.termMonths > 0
            ? (acc.depositedAzn * acc.annualRatePct * acc.termMonths) / 100 / 12
            : 0);
        events.push({
          date,
          amountAzn: -(acc.depositedAzn + Math.max(bonus, 0)),
          label: `Depozit çıxışı — ${name}`,
        });
      }
    }
  }

  // Bond outflows: coupons on schedule, face value at maturity.
  for (const s of bondSeries) {
    if (s.settledUnits <= 0) continue;
    if (!isIsoDate(s.issueDate) || !isIsoDate(s.maturityDate)) continue;

    const couponAzn =
      (s.settledUnits * s.faceValueAzn * s.couponRatePct * s.couponPeriodMonths) /
      100 /
      12;
    if (couponAzn > 0 && s.couponPeriodMonths > 0) {
      for (let n = 1; n <= 240; n += 1) {
        const date = addMonthsIso(s.issueDate, n * s.couponPeriodMonths);
        if (!date || date > s.maturityDate) break;
        if (date < todayIso) continue;
        events.push({ date, amountAzn: -couponAzn, label: `Kupon — ${s.name}` });
      }
    }
    if (s.maturityDate >= todayIso) {
      events.push({
        date: s.maturityDate,
        amountAzn: -(s.settledUnits * s.faceValueAzn),
        label: `İstiqraz nominalı — ${s.name}`,
      });
    }
  }

  if (events.length === 0) return [];

  // One point per date, cumulative from today's net liquidity.
  const byDate = new Map<string, LiquidityEvent[]>();
  for (const e of events) {
    const list = byDate.get(e.date) ?? [];
    list.push(e);
    byDate.set(e.date, list);
  }
  const dates = [...byDate.keys()].sort();

  const start: LiquidityProjectionPoint = {
    date: todayIso,
    valueAzn: startNetLiquidityAzn,
    events: [],
  };
  const points: LiquidityProjectionPoint[] = [start];
  let running = startNetLiquidityAzn;
  for (const date of dates) {
    const dayEvents = byDate.get(date)!;
    running += dayEvents.reduce((s, e) => s + e.amountAzn, 0);
    if (date === todayIso) {
      // Same-day events fold into the start point (no duplicate x values).
      start.valueAzn = running;
      start.events = dayEvents;
    } else {
      points.push({ date, valueAzn: running, events: dayEvents });
    }
  }
  return points;
}
