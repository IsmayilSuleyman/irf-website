import type { Debt } from "@/lib/sheets";

export type DebtSchedulePoint = {
  label: string;
  remaining: number;
};

export type DebtProjection = {
  name: string;
  originalAzn: number;
  remainingAzn: number;
  monthlyPaymentAzn: number;
  annualInterestRate: number;
  payoffMonths: number | null; // null if never pays off within 120 months
};

function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString("az-AZ", { month: "short", year: "numeric" });
}

function projectPayoffMonths(debt: Debt): number | null {
  let remaining = debt.remainingAzn;
  const monthlyRate = debt.annualInterestRate / 12;
  for (let i = 1; i <= 120; i++) {
    const interest = remaining * monthlyRate;
    const payment = Math.min(debt.monthlyPaymentAzn, remaining + interest);
    remaining = Math.max(0, remaining + interest - payment);
    if (remaining === 0) return i;
  }
  return null;
}

export function computeDebtProjections(debts: Debt[]): DebtProjection[] {
  return debts.map((d) => ({
    ...d,
    payoffMonths: projectPayoffMonths(d),
  }));
}

export function computeDebtSchedule(debts: Debt[]): DebtSchedulePoint[] {
  if (debts.length === 0) return [];

  const states = debts.map((d) => ({ remaining: d.remainingAzn, ...d }));
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const totalNow = states.reduce((s, d) => s + d.remaining, 0);
  const points: DebtSchedulePoint[] = [
    { label: formatMonthLabel(startOfMonth), remaining: totalNow },
  ];

  for (let i = 1; i <= 120; i++) {
    let total = 0;
    for (const state of states) {
      if (state.remaining <= 0) continue;
      const monthlyRate = state.annualInterestRate / 12;
      const interest = state.remaining * monthlyRate;
      const payment = Math.min(state.monthlyPaymentAzn, state.remaining + interest);
      state.remaining = Math.max(0, state.remaining + interest - payment);
      total += state.remaining;
    }
    const d = new Date(startOfMonth);
    d.setMonth(d.getMonth() + i);
    points.push({ label: formatMonthLabel(d), remaining: total });
    if (total === 0) break;
  }

  return points;
}
