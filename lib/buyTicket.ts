import { USD_TO_AZN } from "@/lib/portfolio";
import {
  DEFAULT_WEIGHTS,
  type MomentumWeights,
  type ScoredItem,
} from "@/lib/momentum";

// Buy ticket: which holdings this period's contribution goes into, and how
// much of it each gets. Pure functions over the momentum engine's scored rows
// plus the weekly score snapshots — no I/O, so the dashboard and the snapshot
// cron compute an identical ticket.
//
// Why the hysteresis: momentum ranks flip on noise, and acting on every flip
// churns the portfolio for nothing. The advised set changes only after a
// challenger has out-scored the weakest advised holding for enough
// consecutive periods. It guards the whole set, not just the top slot,
// because the budget is spread across every slot. Design decisions:
//
//  • The lead threshold is expressed in RANK-STEPS, not fixed points. One
//    board place on the heaviest factor is worth maxWeight/(n−1) points, so a
//    fixed "5 points" means one place in a 12-holding portfolio and less than
//    a place in a 5-holding one. Scaling by n makes "meaningfully ahead" mean
//    the same thing at any portfolio size.
//  • A streak tracks the challenger against the SET, not against one named
//    incumbent. The bottom two advised holdings swap exactly when their
//    scores are near-tied — keying the streak on the pair would reset the
//    clock in precisely the noisy case the rule exists for. Every challenger
//    keeps its own streak, so two strong candidates can't shadow each other.
//  • "Consecutive" is enforced against the calendar: periods further apart
//    than the cadence allows break every streak. Without this, a month of
//    missed snapshots would stitch distant weeks together as adjacent.
//  • Warm-up: until enough periods exist for a streak to even complete, the
//    set follows the board. Defending the very first snapshot would grant a
//    single unconfirmed week permanent incumbency.
//  • Sector cap: at most MAX_PER_SECTOR advised picks share a sector, so the
//    ticket cannot quietly become three funds of the same bet. Sectors come
//    from the live holdings (an instrument's sector is effectively static).
//  • Refills (a holding sold or vanished from the universe) bypass hysteresis
//    — an empty slot needs no defending — but they are REPORTED as changes,
//    so the verdict can never read "held" while the set silently turned over.

/** One snapshot: every scored ticker's composite score for that period.
 *  `weekStart` is the period's start date — the ISO Baku Monday for weekly
 *  snapshots, the first of the month for aggregated monthly periods. */
export type WeekScores = {
  weekStart: string;
  scores: Record<string, number>;
};

export type PurchaseCadence = "weekly" | "monthly";

export type CadenceRules = {
  /** Consecutive qualifying periods a challenger needs to displace. */
  needed: number;
  /** Adjacent periods further apart than this break every streak. */
  maxGapDays: number;
  /** Azerbaijani copy pieces: "həftə/ay", "həftələr/aylar", "həftəlik/aylıq". */
  noun: string;
  nounPlural: string;
  adjective: string;
};

export const CADENCE_RULES: Record<PurchaseCadence, CadenceRules> = {
  // Three consecutive weekly snapshots — the ETF-Momentum sheet's own
  // anti-whipsaw rule. A skipped week (gap > 10 days) resets the clock.
  weekly: {
    needed: 3,
    maxGapDays: 10,
    noun: "həftə",
    nounPlural: "həftələr",
    adjective: "həftəlik",
  },
  // Monthly periods are averages of the month's weekly snapshots, and the
  // averaging is itself the noise filter — one confirmed month is enough.
  // Requiring two would put ~2 months of lag on a signal that decays in
  // months. A wholly skipped month still resets the streak.
  monthly: {
    needed: 1,
    maxGapDays: 45,
    noun: "ay",
    nounPlural: "aylar",
    adjective: "aylıq",
  },
};

/** How many picks the ticket carries. */
export const TICKET_SIZE = 3;
/** Advised picks allowed to share one sector (unknown sectors are exempt). */
export const MAX_PER_SECTOR = 2;
/** Rank-steps (on the heaviest factor) a challenger must lead by. */
export const LEAD_RANK_STEPS = 1.5;
const LEAD_MIN_PTS = 3;
const LEAD_MAX_PTS = 20;

/**
 * The lead threshold, in composite-score points, for a board of `boardSize`.
 * One board place on the heaviest factor ≈ maxWeight/(n−1) points (weights
 * sum to 100), so 1.5 rank-steps means "clearly more than one place on the
 * strongest factor" at any portfolio size. Clamped so tiny boards don't make
 * switching impossible and huge ones don't make it free.
 */
export function hysteresisLeadFor(
  boardSize: number,
  weights: MomentumWeights = DEFAULT_WEIGHTS,
): number {
  const maxW = Math.max(
    weights.w4,
    weights.w13,
    weights.wYtd,
    weights.wRs,
    weights.wTrend,
  );
  const n = Math.max(2, boardSize);
  const raw = (LEAD_RANK_STEPS * maxW) / (n - 1);
  return (
    Math.round(Math.min(LEAD_MAX_PTS, Math.max(LEAD_MIN_PTS, raw)) * 10) / 10
  );
}

export type Streak = {
  challenger: string;
  /** The currently weakest advised holding (display context, not identity —
   *  the streak survives the weakest changing name). */
  target: string;
  /** The challenger's lead over the weakest in the freshest period. */
  lead: number;
  /** Consecutive qualifying periods so far. */
  periods: number;
};

export type AdvisedChange = {
  /** Displaced holding; null when a refill filled a previously empty slot. */
  from: string | null;
  to: string;
  /** "switch" = hysteresis-confirmed; "refill" = universe exit, no defense. */
  reason: "switch" | "refill";
};

export type Verdict = "seed" | "hold" | "switch";

export type AdvisedState = {
  /** The advised tickers, best-scoring first in the freshest period. */
  advised: string[];
  /** Live challenger streaks, strongest first. Empty when nobody qualifies. */
  streaks: Streak[];
  /** Set changes applied on the freshest period (switches and refills). */
  changes: AdvisedChange[];
  verdict: Verdict;
  /** Periods the verdict rests on. */
  periodsTracked: number;
  /** Effective lead threshold (points) in the freshest period. */
  leadThreshold: number;
  cadence: PurchaseCadence;
  rules: CadenceRules;
};

/** Symbols present in a snapshot, best score first; ties break alphabetically
 *  so a replay is deterministic. */
function ranked(scores: Record<string, number>): string[] {
  return Object.entries(scores)
    .filter(([, v]) => Number.isFinite(v))
    .sort((a, b) => (b[1] !== a[1] ? b[1] - a[1] : a[0] < b[0] ? -1 : 1))
    .map(([symbol]) => symbol);
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.round((to - from) / 86_400_000);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Fold the periods forward to derive the currently advised set. Derived
 * rather than stored: a backfilled or corrected period self-heals on the next
 * read, and there is no second source of truth to drift.
 */
export function resolveAdvised(
  snapshots: WeekScores[],
  opts: {
    cadence?: PurchaseCadence;
    size?: number;
    /** Live symbol → sector map for the sector cap (see module note). */
    sectorOf?: Record<string, string | null>;
    weights?: MomentumWeights;
  } = {},
): AdvisedState {
  const cadence = opts.cadence ?? "weekly";
  const rules = CADENCE_RULES[cadence];
  const size = opts.size ?? TICKET_SIZE;
  const sectorOf = opts.sectorOf ?? {};

  const periods = [...snapshots]
    .filter((w) => Object.keys(w.scores).length > 0)
    .sort((a, b) =>
      a.weekStart < b.weekStart ? -1 : a.weekStart > b.weekStart ? 1 : 0,
    );

  const empty: AdvisedState = {
    advised: [],
    streaks: [],
    changes: [],
    verdict: "seed",
    periodsTracked: periods.length,
    leadThreshold: LEAD_MIN_PTS,
    cadence,
    rules,
  };
  if (periods.length === 0) return empty;

  let advised: string[] = [];
  const streakMap = new Map<string, number>();
  let changes: AdvisedChange[] = [];
  let leadThreshold = LEAD_MIN_PTS;
  let prevStart: string | null = null;

  const sectorCount = (set: string[], sector: string | null | undefined) =>
    sector == null ? 0 : set.filter((s) => sectorOf[s] === sector).length;

  // Fill `set` from the board, preferring candidates that respect the sector
  // cap but falling back past it — a full ticket beats a diversified short
  // one when the universe leaves no compliant choice.
  const fillFrom = (board: string[], set: string[]): string[] => {
    const added: string[] = [];
    while (set.length < size) {
      const next =
        board.find(
          (s) =>
            !set.includes(s) &&
            sectorCount(set, sectorOf[s]) < MAX_PER_SECTOR,
        ) ?? board.find((s) => !set.includes(s));
      if (next == null) break;
      set.push(next);
      added.push(next);
    }
    return added;
  };

  for (let i = 0; i < periods.length; i++) {
    const isLast = i === periods.length - 1;
    if (isLast) changes = [];
    const scores = periods[i].scores;
    const board = ranked(scores);
    if (board.length === 0) continue;

    leadThreshold = hysteresisLeadFor(board.length, opts.weights);

    // A streak must be observed in adjacent periods — a recording gap breaks
    // "consecutive" rather than stitching distant periods together.
    if (
      prevStart != null &&
      daysBetween(prevStart, periods[i].weekStart) > rules.maxGapDays
    ) {
      streakMap.clear();
    }
    prevStart = periods[i].weekStart;

    // Warm-up: not enough history for a streak to complete yet.
    if (i < rules.needed) {
      advised = [];
      fillFrom(board, advised);
      streakMap.clear();
      continue;
    }

    // Universe exits refill without hysteresis; report them on the freshest
    // period so the verdict reflects the turnover.
    const removed = advised.filter((s) => scores[s] == null);
    advised = advised.filter((s) => scores[s] != null);
    const refilled = fillFrom(board, advised);
    if (isLast) {
      refilled.forEach((to, idx) =>
        changes.push({ from: removed[idx] ?? null, to, reason: "refill" }),
      );
    }

    const weakestOf = (set: string[]): string | undefined =>
      [...set].sort((a, b) => scores[a] - scores[b])[0];

    let weakest = weakestOf(advised);
    if (weakest == null) {
      streakMap.clear();
      continue;
    }

    // Accrue or reset every challenger's streak against the set's weakest.
    const candidates = board.filter((s) => !advised.includes(s));
    for (const c of candidates) {
      if (scores[c] - scores[weakest] >= leadThreshold) {
        streakMap.set(c, (streakMap.get(c) ?? 0) + 1);
      } else {
        streakMap.delete(c);
      }
    }
    for (const s of [...streakMap.keys()]) {
      if (advised.includes(s) || scores[s] == null) streakMap.delete(s);
    }

    // Complete streaks displace the current weakest, best challenger first,
    // re-checking lead, cap and the (possibly new) weakest after each swap.
    for (;;) {
      weakest = weakestOf(advised);
      if (weakest == null) break;
      const w = weakest;
      const ready = candidates
        .filter((c) => !advised.includes(c))
        .filter((c) => (streakMap.get(c) ?? 0) >= rules.needed)
        .filter((c) => scores[c] - scores[w] >= leadThreshold)
        .filter(
          (c) =>
            sectorCount(
              advised.filter((s) => s !== w),
              sectorOf[c],
            ) < MAX_PER_SECTOR,
        )
        .sort((a, b) => scores[b] - scores[a]);
      const winner = ready[0];
      if (winner == null) break;
      advised = advised.filter((s) => s !== w);
      advised.push(winner);
      streakMap.delete(winner);
      if (isLast) changes.push({ from: w, to: winner, reason: "switch" });
    }
  }

  const lastScores = periods[periods.length - 1].scores;
  const ordered = [...advised].sort(
    (a, b) => (lastScores[b] ?? 0) - (lastScores[a] ?? 0),
  );
  const weakestFinal = ordered[ordered.length - 1];
  const streaks: Streak[] = [...streakMap.entries()]
    .map(([challenger, periodsHeld]) => ({
      challenger,
      target: weakestFinal ?? "",
      lead: round1(
        (lastScores[challenger] ?? 0) - (lastScores[weakestFinal] ?? 0),
      ),
      periods: periodsHeld,
    }))
    .sort((a, b) => b.periods - a.periods || b.lead - a.lead);

  return {
    advised: ordered,
    streaks,
    changes,
    verdict:
      periods.length <= rules.needed
        ? "seed"
        : changes.length > 0
          ? "switch"
          : "hold",
    periodsTracked: periods.length,
    leadThreshold,
    cadence,
    rules,
  };
}

/**
 * Collapse weekly snapshots into month periods for the monthly cadence.
 * A month's score is the mean of its weekly snapshots (a symbol must appear
 * in at least half of them, so one fluke week cannot speak for a month), and
 * only months strictly before `currentMonthKey` ("YYYY-MM") qualify — the
 * running month changes with every snapshot, and advice that flip-flops
 * mid-month is exactly what the monthly cadence exists to avoid. A week
 * belongs to the month its Monday falls in.
 */
export function aggregateMonthlyPeriods(
  weeks: WeekScores[],
  currentMonthKey: string,
): WeekScores[] {
  const byMonth = new Map<string, WeekScores[]>();
  for (const w of weeks) {
    const key = w.weekStart.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(key) || key >= currentMonthKey) continue;
    const bucket = byMonth.get(key);
    if (bucket) bucket.push(w);
    else byMonth.set(key, [w]);
  }

  return [...byMonth.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, snapshots]) => {
      const minAppearances = Math.ceil(snapshots.length / 2);
      const sums = new Map<string, { sum: number; n: number }>();
      for (const snap of snapshots) {
        for (const [symbol, score] of Object.entries(snap.scores)) {
          if (!Number.isFinite(score)) continue;
          const cur = sums.get(symbol);
          if (cur) {
            cur.sum += score;
            cur.n += 1;
          } else {
            sums.set(symbol, { sum: score, n: 1 });
          }
        }
      }
      const scores: Record<string, number> = {};
      for (const [symbol, { sum, n }] of sums) {
        if (n >= minAppearances) scores[symbol] = round1(sum / n);
      }
      return { weekStart: `${key}-01`, scores };
    })
    .filter((p) => Object.keys(p.scores).length > 0);
}

export type TicketPick = {
  symbol: string;
  name: string;
  sector: string | null;
  score: number;
  /** Position in the ticket, 1-based, best score first. */
  slot: number;
  /** Rank on the raw leaderboard — differs from slot when hysteresis holds
   *  a pick that the raw ranking would have dropped. */
  boardRank: number;
  amountAzn: number;
  /** Shares the amount buys at the current price; null without a price. */
  shares: number | null;
  /** Short reason chips: strongest factor placements, plus the binary flags. */
  why: string[];
  closeCall: boolean;
};

export type BuyTicket = {
  picks: TicketPick[];
  budgetAzn: number;
  /** Budget left unallocated because fewer than `size` holdings scored. */
  unallocatedAzn: number;
  advice: AdvisedState;
};

const FACTOR_LABELS: { key: keyof ScoredItem["ranks"]; short: string }[] = [
  { key: "ret4w", short: "4H" },
  { key: "ret13w", short: "13H" },
  { key: "retYtd", short: "YTD" },
];

/** Reason chips: up to two best factor placements, then the binary flags —
 *  including the negative states, so a pick held by hysteresis while below
 *  its 200-day average says so instead of hiding it. */
export function reasonsFor(row: ScoredItem): string[] {
  const placed = FACTOR_LABELS.flatMap((f) => {
    const rank = row.ranks[f.key];
    return rank != null ? [{ short: f.short, rank }] : [];
  }).sort((a, b) => a.rank - b.rank);

  const strong = placed.filter((p) => p.rank <= 3);
  // Nothing in the top three — quote its best placement anyway so the pick
  // still explains itself rather than showing an empty reason line.
  const why = (strong.length > 0 ? strong : placed.slice(0, 1))
    .slice(0, 2)
    .map((p) => `${p.short} #${Math.round(p.rank)}`);
  if (row.rs != null) why.push(row.rs > 0 ? "S&P ✓" : "S&P ✗");
  if (row.above200 != null) why.push(row.above200 ? "200GO ✓" : "200GO ✗");
  return why;
}

/**
 * Equal split of the budget across the ticket's slots. The composite score is
 * ORDINAL — it says who leads, not by how much; the point-gap between two
 * ranks is an artifact of portfolio size — so proportional-to-score sizing
 * would let the holding count drive position sizes, and would defund the very
 * incumbent the hysteresis defends. Each slot takes budget/size, rounded to
 * qəpik with the drift folded into the first pick; a slot the board cannot
 * fill leaves its share unallocated rather than silently inflating the rest.
 */
export function splitBudget(
  count: number,
  budgetAzn: number,
  size: number = TICKET_SIZE,
): number[] {
  if (count <= 0) return [];
  if (budgetAzn <= 0) return Array(count).fill(0);
  const slots = Math.max(size, count);
  const per = Math.round((budgetAzn / slots) * 100) / 100;
  const amounts: number[] = Array(count).fill(per);
  if (count >= slots) {
    const drift =
      Math.round((budgetAzn - per * count) * 100) / 100;
    amounts[0] = Math.round((amounts[0] + drift) * 100) / 100;
  }
  return amounts;
}

/**
 * Build this period's ticket from the live scores and the advised set. Picks
 * come from `advice.advised` — that is what the hysteresis protects — and are
 * ordered by this period's score.
 */
export function buildTicket(
  rows: ScoredItem[],
  budgetAzn: number,
  advice: AdvisedState,
  size: number = TICKET_SIZE,
): BuyTicket {
  const board = [...rows].sort((a, b) => b.score - a.score);
  const boardRank = new Map(board.map((r, i) => [r.symbol, i + 1]));
  const bySymbol = new Map(board.map((r) => [r.symbol, r]));

  const chosen = advice.advised
    .map((s) => bySymbol.get(s))
    .filter((r): r is ScoredItem => r != null);
  // Advice can lag the live board (a holding sold since the last snapshot);
  // top up from the board so the ticket is never short.
  for (const row of board) {
    if (chosen.length >= size) break;
    if (!chosen.some((c) => c.symbol === row.symbol)) chosen.push(row);
  }
  const picks0 = chosen.slice(0, size).sort((a, b) => b.score - a.score);
  const amounts = splitBudget(picks0.length, budgetAzn, size);

  const picks: TicketPick[] = picks0.map((row, i) => {
    const amountAzn = amounts[i] ?? 0;
    const priceAzn = row.priceUsd > 0 ? row.priceUsd * USD_TO_AZN : 0;
    return {
      symbol: row.symbol,
      name: row.name,
      sector: row.sector,
      score: row.score,
      slot: i + 1,
      boardRank: boardRank.get(row.symbol) ?? i + 1,
      amountAzn,
      shares: priceAzn > 0 ? amountAzn / priceAzn : null,
      why: reasonsFor(row),
      closeCall: row.closeCall,
    };
  });

  const allocated = picks.reduce((s, p) => s + p.amountAzn, 0);
  return {
    picks,
    budgetAzn,
    unallocatedAzn: Math.max(0, Math.round((budgetAzn - allocated) * 100) / 100),
    advice,
  };
}

const fmtPts = (n: number) =>
  (Math.round(n * 10) / 10).toFixed(1).replace(".", ",");

/** One-line summary of the verdict, used by the card and any notification. */
export function verdictSummary(advice: AdvisedState): string {
  const { verdict, advised, streaks, changes, rules, leadThreshold } = advice;
  if (advised.length === 0)
    return "Hələ kifayət qədər məlumat yoxdur.";

  const sw = changes.find((c) => c.reason === "switch");
  if (verdict === "switch" && sw && sw.from) {
    return rules.needed === 1
      ? `${sw.to} ${sw.from} əvəzinə keçdi — ${rules.adjective} ortalamada ən azı ${fmtPts(leadThreshold)} bal öndə oldu.`
      : `${sw.to} ${sw.from} əvəzinə keçdi — ${rules.needed} ${rules.noun} ardıcıl ən azı ${fmtPts(leadThreshold)} bal öndə oldu.`;
  }
  const refill = changes.find((c) => c.reason === "refill");
  if (verdict === "switch" && refill) {
    return refill.from
      ? `${refill.from} portfeldən çıxdığı üçün yerinə ${refill.to} əlavə olundu.`
      : `${refill.to} boş yerə əlavə olundu.`;
  }
  if (verdict === "seed") {
    return `İlk ${rules.nounPlural}: seçim cari sıralamaya görədir (${advice.periodsTracked} ${rules.adjective} məlumat).`;
  }
  const streak = streaks[0];
  if (streak) {
    const left = Math.max(0, rules.needed - streak.periods);
    return `Seçim saxlanılır — ${streak.challenger} ən zəif seçim ${streak.target} üzərində ${fmtPts(streak.lead)} bal öndədir, ${streak.periods}/${rules.needed} ${rules.noun}${left > 0 ? ` (daha ${left} ${rules.noun} lazımdır)` : ""}.`;
  }
  return `Seçim saxlanılır — heç bir namizəd tələb olunan ${fmtPts(leadThreshold)} bal fərqi yaratmayıb.`;
}
