import type { ScoredItem } from "@/lib/momentum";
import {
  CADENCE_RULES,
  type CadenceRules,
  type PurchaseCadence,
  type WeekFacts,
  type WeekScores,
} from "@/lib/buyTicket";

// Sell side of the ticket (Satış siqnalları). Pure functions, like the buy
// side — the dashboard feeds it the same periods the buy fold reads.
//
// The trigger is the evidence-backed composite İsmayıl asked to be researched:
//
//   SAT  = price below its 200-day average (Faber 2007's trend rule — the
//          10-month SMA exit that cut a 46% drawdown to under 10%)
//          AND momentum is negative or losing to the market (Antonacci's
//          absolute momentum / Jegadeesh–Titman relative momentum; our
//          longest lookback is 13W — the literature prefers 12 months, which
//          the sheet does not carry yet),
//          CONFIRMED over the cadence's periods — the same anti-whipsaw
//          discipline as the buy hysteresis, and the moral equivalent of
//          Faber evaluating only at month-end.
//
//   İZLƏ = the trend has broken now but is not confirmed yet (below the
//          200-day average), OR the crash guard fired: the 4W return is
//          under −10%, echoing Han–Zhou–Zhu's stop-loss that tamed momentum
//          crashes. Early warning only — it never blocks the buy side.
//
// A holding with a confirmed SAT is excluded from the buy ticket and its
// budget share stays unallocated (dual momentum's answer to a broken trend
// is cash, not the next-best broken thing).
//
// P&L context (İsmayıl's "sell for profit" lens) is shown on every signal
// but gates nothing: Odean's disposition-effect result is precisely that
// selling only winners and sitting on losers costs money, so the card shows
// the state and leaves the decision to him.

/** 4W drawdown that fires the crash-guard watch flag. */
export const CRASH_DROP = -0.1;

export type SellLevel = "sat" | "izle";

export type SellSignal = {
  symbol: string;
  name: string;
  sector: string | null;
  level: SellLevel;
  /** True condition chips, in display order (AZ). */
  reasons: string[];
  /** Consecutive periods the core exit condition has held in the history. */
  confirmedPeriods: number;
  neededPeriods: number;
  /** Unrealized P&L vs average purchase; null without a cost basis. */
  plPct: number | null;
  plAzn: number | null;
};

export type HoldingPnl = { plPct: number | null; plAzn: number | null };

export type SellState = {
  /** SAT first, then İZLƏ; weakest holdings first within a level. */
  signals: SellSignal[];
  /** Symbols with a confirmed SAT — the buy ticket's exclusion set. */
  confirmed: Set<string>;
  cadence: PurchaseCadence;
  rules: CadenceRules;
};

const fmtPct = (v: number) =>
  `${v > 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1).replace(".", ",")}%`;

/** The confirmed core exit condition, judged from stored facts. Unknown
 *  facts never assert a break. */
function brokenInFacts(f: WeekFacts | undefined): boolean | null {
  if (f == null || f.above200 == null) return null;
  if (f.above200) return false;
  const absNeg = f.ret13w != null && f.ret13w < 0;
  const relNeg = f.beatsSpy === false;
  if (f.ret13w == null && f.beatsSpy == null) return null;
  return absNeg || relNeg;
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.round((to - from) / 86_400_000);
}

/**
 * Consecutive trailing periods in which `symbol`'s core exit condition held.
 * Trailing periods with UNKNOWN facts are skipped (the current week's row
 * predates the facts columns, and skipping is not evidence either way), but
 * a known-unbroken period or a calendar gap stops the count — "confirmed"
 * must mean observed in adjacent periods, exactly like the buy streaks.
 */
export function confirmedBrokenPeriods(
  periods: WeekScores[],
  symbol: string,
  maxGapDays: number,
): number {
  let i = periods.length - 1;
  while (i >= 0 && brokenInFacts(periods[i].facts?.[symbol]) == null) i -= 1;

  let count = 0;
  let prevStart: string | null = null;
  for (; i >= 0; i -= 1) {
    const state = brokenInFacts(periods[i].facts?.[symbol]);
    if (state !== true) break;
    if (
      prevStart != null &&
      daysBetween(periods[i].weekStart, prevStart) > maxGapDays
    ) {
      break;
    }
    count += 1;
    prevStart = periods[i].weekStart;
  }
  return count;
}

/**
 * Derive the sell signals for the current holdings. `periods` is the same
 * cadence-shaped series the buy fold reads (weekly: snapshots incl. the
 * current week; monthly: completed month averages) — the LIVE row always
 * gates the verdict, so a signal disappears the moment the condition heals.
 */
export function resolveSellSignals(
  periods: WeekScores[],
  rows: ScoredItem[],
  opts: {
    cadence?: PurchaseCadence;
    pnlOf?: Record<string, HoldingPnl>;
  } = {},
): SellState {
  const cadence = opts.cadence ?? "weekly";
  const rules = CADENCE_RULES[cadence];
  const pnlOf = opts.pnlOf ?? {};

  const signals: SellSignal[] = [];
  const confirmed = new Set<string>();

  for (const row of rows) {
    const below200 = row.above200 === false;
    const absNeg = row.ret13w != null && row.ret13w < 0;
    const relNeg = row.rs != null && row.rs < 0;
    const crash = row.ret4w != null && row.ret4w <= CRASH_DROP;
    const coreNow = below200 && (absNeg || relNeg);

    if (!below200 && !crash) continue;

    const confirmedPeriods = coreNow
      ? confirmedBrokenPeriods(periods, row.symbol, rules.maxGapDays)
      : 0;
    const isSat = coreNow && confirmedPeriods >= rules.needed;

    const reasons: string[] = [];
    if (below200) reasons.push("200GO altında");
    if (absNeg) reasons.push("13H mənfi");
    if (relNeg) reasons.push("S&P-dən geridə");
    if (crash && row.ret4w != null) reasons.push(`4H ${fmtPct(row.ret4w)}`);

    const pnl = pnlOf[row.symbol] ?? { plPct: null, plAzn: null };
    signals.push({
      symbol: row.symbol,
      name: row.name,
      sector: row.sector,
      level: isSat ? "sat" : "izle",
      reasons,
      confirmedPeriods,
      neededPeriods: rules.needed,
      plPct: pnl.plPct,
      plAzn: pnl.plAzn,
    });
    if (isSat) confirmed.add(row.symbol);
  }

  signals.sort((a, b) => {
    if (a.level !== b.level) return a.level === "sat" ? -1 : 1;
    return b.confirmedPeriods - a.confirmedPeriods;
  });

  return { signals, confirmed, cadence, rules };
}
