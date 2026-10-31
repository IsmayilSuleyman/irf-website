import { isPaymentPaid, simplifyText } from "@/lib/bankShared";
import { parseSheetDateMs } from "@/lib/sheetDates";

// Pul axını — one dated ledger of EVERY movement the bank's records can
// see, folded from the four places money leaves a trace:
//
//   • bank_daily_snapshots (Supabase, nightly): day-over-day deltas of the
//     Sheet balances (deposits, loans). The Sheet itself only holds the
//     current figure, so the snapshot series IS the dated record of when a
//     deposit arrived or a loan went out. A loan decrease is matched to a
//     paid schedule installment of the same amount nearby so the row can
//     carry the borrower's name.
//   • bond_trades / bond_payments (Supabase): primary sales bring cash in;
//     coupons and principal go out. P2P trades move bonds between holders
//     and no bank cash — listed as transfers, excluded from the sums.
//   • bank_interest_accruals / daily_reward_claims (Supabase): the daily
//     ledgers. An accrual is an obligation booked, not cash moved — kept in
//     its own "accrued" bucket; a settlement is the moment it becomes Sheet
//     deposit (capitalised), listed but never summed, because the deposit
//     delta already counts that money.
//   • the Aktivlər tab (Sheet): ETF buys bring paid cash into the reserve;
//     sells release it.
//
// Pure functions over already-fetched rows (the caller passes `today`), so
// the whole ledger is unit-testable and client-safe — the dashboard filters
// it by period in the browser.

export type FlowChannel =
  | "deposit"
  | "credit"
  | "bond"
  | "interest"
  | "reward"
  | "asset"
  | "founder";

/**
 * cash     — money actually moved between the bank and someone (summed).
 * accrual  — an obligation booked (daily interest / reward), summed apart.
 * transfer — informational: a settlement, a P2P bond trade; never summed.
 */
export type FlowKind = "cash" | "accrual" | "transfer";

export type FlowEvent = {
  /** Stable key for React lists. */
  id: string;
  /** YYYY-MM-DD (Baku day for Supabase rows, the snapshot day for deltas). */
  date: string;
  channel: FlowChannel;
  kind: FlowKind;
  /** Signed: + into the bank, − out of the bank. Accruals are + (owed more). */
  amountAzn: number;
  label: string;
  /** Holder the row belongs to, raw Sheet casing; null for bank-wide deltas. */
  person: string | null;
  hint?: string;
  /** True when the row is the founder's own money (founder mode only). */
  founder?: boolean;
};

export type FlowSnapshotRow = {
  date: string; // YYYY-MM-DD
  depositsAzn: number;
  loansAzn: number;
};

export type FlowScheduleAccount = {
  name: string;
  depositedAzn: number;
  outstandingLoanAzn: number;
  paymentSchedule: { date: string; amountAzn: number | null; status: string | null; label: string | null }[];
};

export type FlowBondTrade = {
  id: string;
  seriesName: string;
  buyerName: string;
  sellerName: string;
  units: number;
  price: number;
  counterpartyKind: "p2p" | "primary";
  /** ISO timestamp of settlement; only settled trades are passed. */
  settledAt: string;
};

export type FlowBondPayment = {
  id: string;
  seriesName: string;
  paymentKind: "coupon" | "principal";
  dueDate: string;
  holderName: string;
  units: number;
  amountAzn: number;
  /** ISO timestamp — when the money actually went out. */
  paidAt: string;
};

export type FlowLedgerRow = {
  holderName: string;
  /** Baku day the amount was earned / claimed. */
  date: string;
  amountAzn: number;
  settledAt: string | null;
};

export type FlowAssetTx = {
  holderName: string;
  /** Sheet date cell, any supported format. */
  date: string;
  symbol: string;
  units: number;
  /** Paid basis in AZN (null = market fill → caller resolves before passing). */
  paidAzn: number;
};

export type MoneyFlowInput = {
  today: Date;
  snapshots: FlowSnapshotRow[];
  /** Live Sheet figures — the delta since the last snapshot becomes a
   *  "today" row so the ledger is current to the minute, not to last night. */
  live: { depositsAzn: number; loansAzn: number } | null;
  accounts: FlowScheduleAccount[];
  bondTrades: FlowBondTrade[];
  bondPayments: FlowBondPayment[];
  interest: FlowLedgerRow[];
  rewards: FlowLedgerRow[];
  assets: FlowAssetTx[];
  /** Founder mode: this holder's own money is capital, not a customer's. */
  founderName?: string | null;
};

export type MoneyFlowSummary = {
  inAzn: number;
  outAzn: number;
  netAzn: number;
  accruedAzn: number;
  byChannel: Record<FlowChannel, { inAzn: number; outAzn: number; accruedAzn: number }>;
};

const norm = (s: string) =>
  simplifyText(s).trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");

const sameName = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && norm(a) === norm(b);

const round2 = (n: number) => Math.round(n * 100) / 100;

// Baku is fixed UTC+4 — manual math, no Intl (hydration rule).
export function bakuDayIsoOf(iso: string): string {
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return iso.slice(0, 10);
  return new Date(ms + 4 * 3_600_000).toISOString().slice(0, 10);
}

function todayBakuIso(today: Date): string {
  return new Date(today.getTime() + 4 * 3_600_000).toISOString().slice(0, 10);
}

function isoFromSheetDate(value: string): string | null {
  const ms = parseSheetDateMs(value);
  return ms == null ? null : new Date(ms).toISOString().slice(0, 10);
}

function daysApart(a: string, b: string): number {
  const ma = new Date(`${a}T00:00:00Z`).getTime();
  const mb = new Date(`${b}T00:00:00Z`).getTime();
  return Math.abs(Math.round((ma - mb) / 86_400_000));
}

/** Builds the full ledger, newest first. */
export function buildMoneyFlow(input: MoneyFlowInput): FlowEvent[] {
  const events: FlowEvent[] = [];
  const founder = input.founderName ?? null;
  const isFounder = (name: string | null) => !!founder && sameName(name, founder);

  // --- Paid installments, available for name-matching the loan deltas. ---
  const paidInstallments: { name: string; date: string; amountAzn: number; used: boolean }[] = [];
  for (const acc of input.accounts) {
    for (const item of acc.paymentSchedule) {
      if (item.amountAzn == null || item.amountAzn <= 0) continue;
      if (!isPaymentPaid(item.status)) continue;
      const date = isoFromSheetDate(item.date);
      if (!date) continue;
      paidInstallments.push({ name: acc.name, date, amountAzn: item.amountAzn, used: false });
    }
  }
  const claimInstallment = (amountAzn: number, date: string) => {
    let best: (typeof paidInstallments)[number] | null = null;
    for (const p of paidInstallments) {
      if (p.used || Math.abs(p.amountAzn - amountAzn) > 0.005) continue;
      const gap = daysApart(p.date, date);
      if (gap > 10) continue;
      if (!best || gap < daysApart(best.date, date)) best = p;
    }
    if (best) best.used = true;
    return best;
  };

  // --- Sheet balance deltas: snapshot to snapshot, then snapshot to live. ---
  const snaps = [...input.snapshots].sort((a, b) => (a.date < b.date ? -1 : 1));
  const steps: { date: string; prev: FlowSnapshotRow; next: FlowSnapshotRow; live: boolean }[] = [];
  for (let i = 1; i < snaps.length; i += 1) {
    steps.push({ date: snaps[i].date, prev: snaps[i - 1], next: snaps[i], live: false });
  }
  if (input.live && snaps.length > 0) {
    const last = snaps[snaps.length - 1];
    steps.push({
      date: todayBakuIso(input.today),
      prev: last,
      next: { date: todayBakuIso(input.today), ...input.live },
      live: true,
    });
  }
  for (const step of steps) {
    const dDep = round2(step.next.depositsAzn - step.prev.depositsAzn);
    const dLoan = round2(step.next.loansAzn - step.prev.loansAzn);
    const liveHint = step.live ? "cədvəlin canlı rəqəmi ilə son gecə qeydinin fərqi" : "əvvəlki gün qeydindən fərq";
    if (Math.abs(dDep) >= 0.005) {
      events.push({
        id: `dep-${step.date}`,
        date: step.date,
        channel: "deposit",
        kind: "cash",
        amountAzn: dDep,
        label: dDep > 0 ? "Depozit balansı artdı" : "Depozit balansı azaldı",
        person: null,
        hint:
          dDep > 0
            ? `yeni yatırım və ya hesablaşdırılmış faiz · ${liveHint}`
            : `depozit çıxışı · ${liveHint}`,
      });
    }
    if (Math.abs(dLoan) >= 0.005) {
      if (dLoan < 0) {
        const match = claimInstallment(-dLoan, step.date);
        events.push({
          id: `loan-${step.date}`,
          date: step.date,
          channel: "credit",
          kind: "cash",
          amountAzn: -dLoan,
          label: "Kredit qaytarıldı",
          person: match?.name ?? null,
          hint: match ? `cədvəl üzrə ödəniş · ${liveHint}` : `kredit qalığı azaldı · ${liveHint}`,
        });
      } else {
        events.push({
          id: `loan-${step.date}`,
          date: step.date,
          channel: "credit",
          kind: "cash",
          amountAzn: -dLoan,
          label: "Kredit verildi",
          person: null,
          hint: `kredit qalığı artdı · ${liveHint}`,
        });
      }
    }
  }

  // --- Bonds: primary sales in, coupons/principal out, P2P as transfers. ---
  for (const t of input.bondTrades) {
    const date = bakuDayIsoOf(t.settledAt);
    const amount = round2(t.units * t.price);
    if (t.counterpartyKind === "primary") {
      const own = isFounder(t.buyerName);
      events.push({
        id: `bt-${t.id}`,
        date,
        channel: own ? "founder" : "bond",
        kind: "cash",
        amountAzn: amount,
        label: own ? "Kapital qoyuluşu — istiqraz" : `İstiqraz satışı — ${t.seriesName}`,
        person: t.buyerName,
        hint: `${t.units} × ${t.price} ₼ · ${t.seriesName}`,
        founder: own || undefined,
      });
    } else {
      events.push({
        id: `bt-${t.id}`,
        date,
        channel: "bond",
        kind: "transfer",
        amountAzn: amount,
        label: `İstiqraz köçürməsi — ${t.seriesName}`,
        person: t.buyerName,
        hint: `${t.sellerName} → ${t.buyerName} · ${t.units} ədəd · bank pulu hərəkət etmir`,
      });
    }
  }
  for (const p of input.bondPayments) {
    const own = isFounder(p.holderName);
    events.push({
      id: `bp-${p.id}`,
      date: bakuDayIsoOf(p.paidAt),
      channel: own ? "founder" : "bond",
      kind: own ? "transfer" : "cash",
      amountAzn: own ? p.amountAzn : -p.amountAzn,
      label:
        p.paymentKind === "coupon"
          ? `Kupon ödənişi — ${p.seriesName}`
          : `Nominal qaytarımı — ${p.seriesName}`,
      person: p.holderName,
      hint: own
        ? `təsisçinin öz istiqrazı · daxili ödəniş · ${p.units} ədəd`
        : `${p.units} ədəd · ödəniş tarixi ${p.dueDate}`,
      founder: own || undefined,
    });
  }

  // --- Daily ledgers: accruals booked, settlements capitalised. ---
  const ledger = (rows: FlowLedgerRow[], channel: "interest" | "reward", prefix: string) => {
    for (const r of rows) {
      const own = isFounder(r.holderName);
      const key = `${prefix}-${norm(r.holderName)}-${r.date}`;
      events.push({
        id: key,
        date: r.date,
        channel: own ? "founder" : channel,
        kind: own ? "transfer" : "accrual",
        amountAzn: r.amountAzn,
        label: channel === "interest" ? "Günlük faiz hesablandı" : "Günlük mükafat",
        person: r.holderName,
        hint: own
          ? "təsisçinin öz hesabı · öhdəlik sayılmır"
          : r.settledAt
            ? `hesablaşdırılıb ${bakuDayIsoOf(r.settledAt)}`
            : "hesablaşdırılmayıb — depozitə köçürülənədək öhdəlikdir",
        founder: own || undefined,
      });
    }
  };
  ledger(input.interest, "interest", "int");
  ledger(input.rewards, "reward", "rew");

  // Settlement moments, one row per holder per settlement day: the amount
  // that became Sheet deposit. Listed as transfers (the deposit delta already
  // carries the cash side).
  const settle = new Map<string, { date: string; name: string; amountAzn: number; channel: "interest" | "reward" }>();
  const fold = (rows: FlowLedgerRow[], channel: "interest" | "reward") => {
    for (const r of rows) {
      if (!r.settledAt || isFounder(r.holderName)) continue;
      const date = bakuDayIsoOf(r.settledAt);
      const key = `${channel}-${norm(r.holderName)}-${date}`;
      const cur = settle.get(key);
      if (cur) cur.amountAzn += r.amountAzn;
      else settle.set(key, { date, name: r.holderName, amountAzn: r.amountAzn, channel });
    }
  };
  fold(input.interest, "interest");
  fold(input.rewards, "reward");
  for (const [key, s] of settle) {
    events.push({
      id: `set-${key}`,
      date: s.date,
      channel: s.channel,
      kind: "transfer",
      amountAzn: round2(s.amountAzn),
      label: s.channel === "interest" ? "Faiz depozitə köçürüldü" : "Mükafat depozitə köçürüldü",
      person: s.name,
      hint: "hesablaşma — öhdəlikdən çıxıb, depozit balansına daxil olub",
    });
  }

  // --- The vault ledger: ETF cash into / out of the reserve. ---
  input.assets.forEach((a, i) => {
    const date = isoFromSheetDate(a.date);
    if (!date) return;
    const buy = a.units > 0;
    const amount = round2(Math.abs(a.paidAzn));
    if (amount < 0.005) return;
    events.push({
      id: `as-${i}-${norm(a.holderName)}-${a.symbol}-${date}`,
      date,
      channel: "asset",
      kind: "cash",
      amountAzn: buy ? amount : -amount,
      label: buy ? `Aktiv alışı — ${a.symbol}` : `Aktiv satışı — ${a.symbol}`,
      person: a.holderName,
      hint: buy
        ? `${a.units} ədəd · ehtiyata daxil olub, kreditə verilmir`
        : `${Math.abs(a.units)} ədəd · ehtiyatdan çıxıb`,
    });
  });

  // Newest first; inside a day, cash before accruals, bigger first.
  const kindRank: Record<FlowKind, number> = { cash: 0, transfer: 1, accrual: 2 };
  events.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    if (kindRank[a.kind] !== kindRank[b.kind]) return kindRank[a.kind] - kindRank[b.kind];
    return Math.abs(b.amountAzn) - Math.abs(a.amountAzn);
  });
  return events;
}

const CHANNELS: FlowChannel[] = [
  "deposit",
  "credit",
  "bond",
  "interest",
  "reward",
  "asset",
  "founder",
];

/** Sums for a window: `fromIso` inclusive (null = everything). */
export function summarizeMoneyFlow(
  events: FlowEvent[],
  fromIso: string | null,
): MoneyFlowSummary {
  const byChannel = Object.fromEntries(
    CHANNELS.map((c) => [c, { inAzn: 0, outAzn: 0, accruedAzn: 0 }]),
  ) as MoneyFlowSummary["byChannel"];
  let inAzn = 0;
  let outAzn = 0;
  let accruedAzn = 0;
  for (const e of events) {
    if (fromIso && e.date < fromIso) continue;
    const c = byChannel[e.channel];
    if (e.kind === "cash") {
      if (e.amountAzn >= 0) {
        inAzn += e.amountAzn;
        c.inAzn += e.amountAzn;
      } else {
        outAzn += -e.amountAzn;
        c.outAzn += -e.amountAzn;
      }
    } else if (e.kind === "accrual") {
      accruedAzn += e.amountAzn;
      c.accruedAzn += e.amountAzn;
    }
  }
  return {
    inAzn: round2(inAzn),
    outAzn: round2(outAzn),
    netAzn: round2(inAzn - outAzn),
    accruedAzn: round2(accruedAzn),
    byChannel,
  };
}

export const FLOW_CHANNEL_LABEL: Record<FlowChannel, string> = {
  deposit: "Depozit",
  credit: "Kredit",
  bond: "İstiqraz",
  interest: "Günlük faiz",
  reward: "Mükafat",
  asset: "Aktivlər",
  founder: "Təsisçi",
};
