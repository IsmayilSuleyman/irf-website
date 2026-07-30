import { USD_TO_AZN } from "@/lib/portfolio";
import type { ScoredItem } from "@/lib/momentum";

// Weekly buy ticket: which holdings this week's contribution goes into, and
// how much of it each gets. Pure functions over the momentum engine's scored
// rows plus the weekly score snapshots — no I/O, so the dashboard and any
// server job compute an identical ticket.
//
// Why the hysteresis: momentum ranks flip on noise, and acting on every flip
// churns the portfolio for nothing. The advised set changes only after a
// challenger has out-scored the weakest advised holding by HYSTERESIS_LEAD
// points in HYSTERESIS_WEEKS consecutive snapshots — the ETF-Momentum
// sheet's own anti-whipsaw rule. It guards the whole set, not just the top
// slot, because two thirds of the budget sit in slots 2 and 3.

/** One weekly snapshot: every scored ticker's composite score that week. */
export type WeekScores = {
  /** ISO date of the week's Monday in Baku, as stored by the snapshot RPC. */
  weekStart: string;
  scores: Record<string, number>;
};

/** Points a challenger must lead the weakest advised holding by. */
export const HYSTERESIS_LEAD = 5;
/** Consecutive weekly snapshots it must hold that lead for. */
export const HYSTERESIS_WEEKS = 3;
/** How many picks the ticket carries. */
export const TICKET_SIZE = 3;

export type Streak = {
  challenger: string;
  /** The advised holding it is trying to displace. */
  target: string;
  /** The challenger's lead in the freshest snapshot, in points. */
  lead: number;
  /** Consecutive qualifying weeks so far. */
  weeks: number;
};

export type Verdict = "seed" | "hold" | "switch";

export type AdvisedState = {
  /** The advised tickers, best-scoring first in the freshest snapshot. */
  advised: string[];
  /** The live challenger, or null when nobody is within striking distance. */
  streak: Streak | null;
  /** Set when the advice changed on the freshest snapshot. */
  switched: { from: string; to: string } | null;
  verdict: Verdict;
  /** Snapshots the verdict rests on. */
  weeksTracked: number;
};

const EMPTY_ADVISED: AdvisedState = {
  advised: [],
  streak: null,
  switched: null,
  verdict: "seed",
  weeksTracked: 0,
};

/** Symbols present in a snapshot, best score first; ties break alphabetically
 *  so a replay is deterministic. */
function ranked(scores: Record<string, number>): string[] {
  return Object.entries(scores)
    .filter(([, v]) => Number.isFinite(v))
    .sort((a, b) => (b[1] !== a[1] ? b[1] - a[1] : a[0] < b[0] ? -1 : 1))
    .map(([symbol]) => symbol);
}

/**
 * Fold the snapshots forward to derive the currently advised set. Derived
 * rather than stored: a backfilled or corrected week self-heals on the next
 * read, and there is no second source of truth to drift.
 */
export function resolveAdvised(
  snapshots: WeekScores[],
  size: number = TICKET_SIZE,
  lead: number = HYSTERESIS_LEAD,
  needed: number = HYSTERESIS_WEEKS,
): AdvisedState {
  const weeks = [...snapshots]
    .filter((w) => Object.keys(w.scores).length > 0)
    .sort((a, b) =>
      a.weekStart < b.weekStart ? -1 : a.weekStart > b.weekStart ? 1 : 0,
    );
  if (weeks.length === 0) return EMPTY_ADVISED;

  let advised: string[] = [];
  let streak: Streak | null = null;
  let switched: AdvisedState["switched"] = null;
  let seeded = false;

  for (let i = 0; i < weeks.length; i++) {
    const isLast = i === weeks.length - 1;
    if (isLast) switched = null;
    const scores = weeks[i].scores;
    const board = ranked(scores);
    if (board.length === 0) continue;

    if (advised.length === 0) {
      advised = board.slice(0, size);
      seeded = true;
      continue;
    }

    // Drop holdings that left the universe (sold, or their factors vanished),
    // then refill from the board — an empty slot needs no hysteresis.
    advised = advised.filter((s) => scores[s] != null);
    for (const symbol of board) {
      if (advised.length >= size) break;
      if (!advised.includes(symbol)) advised.push(symbol);
    }

    const weakest = [...advised].sort((a, b) => scores[a] - scores[b])[0];
    const challenger = board.find((s) => !advised.includes(s)) ?? null;
    if (weakest == null || challenger == null) {
      streak = null;
      continue;
    }

    const gap = scores[challenger] - scores[weakest];
    if (gap < lead) {
      // The rule is consecutive weeks — one quiet week resets the clock.
      streak = null;
      continue;
    }

    streak =
      streak != null &&
      streak.challenger === challenger &&
      streak.target === weakest
        ? { challenger, target: weakest, lead: gap, weeks: streak.weeks + 1 }
        : { challenger, target: weakest, lead: gap, weeks: 1 };

    if (streak.weeks >= needed) {
      advised = advised.filter((s) => s !== weakest);
      advised.push(challenger);
      if (isLast) switched = { from: weakest, to: challenger };
      streak = null;
    }
  }

  const lastScores = weeks[weeks.length - 1].scores;
  const ordered = [...advised].sort(
    (a, b) => (lastScores[b] ?? 0) - (lastScores[a] ?? 0),
  );

  return {
    advised: ordered,
    streak,
    switched,
    verdict: switched ? "switch" : seeded && weeks.length === 1 ? "seed" : "hold",
    weeksTracked: weeks.length,
  };
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
  /** Short reason chips: strongest factor placements, plus the trend flag. */
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
  { key: "rs", short: "RS" },
];

/** Up to three reason chips: best factor placements, then the trend flag. */
export function reasonsFor(row: ScoredItem): string[] {
  const placed = FACTOR_LABELS.flatMap((f) => {
    const rank = row.ranks[f.key];
    return rank != null ? [{ short: f.short, rank }] : [];
  }).sort((a, b) => a.rank - b.rank);

  const strong = placed.filter((p) => p.rank <= 3);
  // Nothing in the top three — quote its best placement anyway so the pick
  // still explains itself rather than showing an empty reason line.
  const why = (strong.length > 0 ? strong : placed.slice(0, 1))
    .slice(0, 3)
    .map((p) => `${p.short} #${p.rank}`);
  if (row.above200) why.push("200GO ✓");
  return why;
}

/**
 * Score-weighted split: each pick's share of the budget equals its share of
 * the picks' combined score, so a runaway leader draws proportionally more
 * and near-tied picks land near-even. Rounded to qəpik, with the rounding
 * remainder folded into the first pick so the parts sum to exactly the whole.
 */
export function splitByScore(scores: number[], budgetAzn: number): number[] {
  const positive = scores.map((s) => Math.max(0, s));
  if (budgetAzn <= 0 || positive.length === 0) return positive.map(() => 0);
  const total = positive.reduce((a, b) => a + b, 0);
  // An all-zero board (every pick bottom-ranked) still deserves a split.
  const weights =
    total > 0
      ? positive.map((s) => s / total)
      : positive.map(() => 1 / positive.length);
  const rounded = weights.map((w) => Math.round(w * budgetAzn * 100) / 100);
  const drift =
    Math.round((budgetAzn - rounded.reduce((a, b) => a + b, 0)) * 100) / 100;
  rounded[0] = Math.round((rounded[0] + drift) * 100) / 100;
  return rounded;
}

/**
 * Build this week's ticket from the live scores and the advised set. Picks
 * come from `advice.advised` — that is what the hysteresis protects — and are
 * ordered by this week's score.
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
  // Advice can lag the live board by a week (a holding sold since the last
  // snapshot); top up from the board so the ticket is never short.
  for (const row of board) {
    if (chosen.length >= size) break;
    if (!chosen.some((c) => c.symbol === row.symbol)) chosen.push(row);
  }
  const picks0 = chosen.slice(0, size).sort((a, b) => b.score - a.score);
  const amounts = splitByScore(
    picks0.map((r) => r.score),
    budgetAzn,
  );

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

/** One-line summary of the verdict, used by the card and any notification. */
export function verdictSummary(advice: AdvisedState): string {
  const { verdict, advised, streak, switched, weeksTracked } = advice;
  if (advised.length === 0) return "Hələ kifayət qədər həftəlik məlumat yoxdur.";
  if (verdict === "switch" && switched) {
    return `${switched.to} ${switched.from} əvəzinə keçdi — ${HYSTERESIS_WEEKS} həftə ardıcıl öndə oldu.`;
  }
  if (verdict === "seed") {
    return `İlk həftə: seçim cari sıralamaya görədir (${weeksTracked} həftəlik məlumat).`;
  }
  if (streak) {
    return `Seçim saxlanılır — ${streak.challenger} ${streak.target} üstündə ${streak.lead.toFixed(1)} bal öndədir, ${streak.weeks}/${HYSTERESIS_WEEKS} həftə (daha ${Math.max(0, HYSTERESIS_WEEKS - streak.weeks)} həftə lazımdır).`;
  }
  return "Seçim saxlanılır — heç bir namizəd 5 bal fərq yaratmayıb.";
}
