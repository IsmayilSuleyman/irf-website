// Momentum ranking engine — client-safe port of the ETF-Momentum sheet's
// Rankings logic. Each return factor becomes an ordinal rank among the
// holdings that have data for it, ranks normalize to 0..1 via (N−rank)/(N−1),
// and the composite is the weighted mean of the available factors ×100.
// Deliberate departures from the sheet:
//  • Missing ordinal factors renormalize the weight base instead of producing
//    degenerate scores, so a young ETF with no YTD history competes fairly on
//    its remaining factors.
//  • Tied factor values share the average of their positions instead of being
//    split by sort order — with few holdings an arbitrary tie-break is worth
//    several points.
//  • Relative strength is a BINARY factor (beats SPY over 13W or not), not an
//    ordinal one. Ranking rs = ret13w − spyRet13w ordinally is a mirage:
//    subtracting the same constant from every holding cannot change an
//    ordering, so an ordinal RS is byte-for-byte the 13W ranking again. The
//    cardinal sign is the only part of RS that carries information the 13W
//    rank does not — whether the holding actually beats the market.
//  • Binary factors (RS, 200DMA trend) score a neutral half-credit when the
//    data is missing, so "unknown" lands between "known good" and "known
//    bad". Renormalizing them away instead would rank a holding with no
//    200-day history above an identical one known to be below its average.

export type MomentumItem = {
  symbol: string;
  name: string;
  sector: string | null;
  /** Current AZN value of the holding — used for allocation weighting. */
  valueAzn: number;
  priceUsd: number;
  /** ~200-day average close, USD (Watchlist col U). */
  avg200Usd: number | null;
  /** Fractional returns vs the Watchlist reference closes (R/S/T). */
  ret4w: number | null;
  ret13w: number | null;
  retYtd: number | null;
  /** Relative strength: ret13w − SPY's ret13w (fraction). */
  rs: number | null;
  /** Price above the 200-day average? Null when no average exists. */
  above200: boolean | null;
};

/** Ordinal (ranked) factors. RS and the 200DMA trend are binary — see below. */
export type FactorKey = "ret4w" | "ret13w" | "retYtd";

export type MomentumWeights = {
  w4: number;
  w13: number;
  wYtd: number;
  /** Binary: price beats SPY over 13 weeks. */
  wRs: number;
  /** Binary: price above its 200-day average. */
  wTrend: number;
};

/**
 * Model weights. The sheet's originals were 4W 30 / 13W 25 / YTD 20 / RS 15 /
 * 200DMA 10 — two deliberate changes:
 *  • 4W demoted, 13W promoted. One-month returns are the classic short-term
 *    REVERSAL horizon (the standard momentum construction excludes the
 *    freshest month entirely); top-weighting 4W bets on the part of the
 *    signal most likely to mean-revert.
 *  • The old ordinal RS was a duplicate of the 13W rank (constant shift), so
 *    its 15 points effectively sat on 13W already — the new split makes that
 *    explicit and spends the 15 on the binary beats-SPY flag instead.
 */
export const DEFAULT_WEIGHTS: MomentumWeights = {
  w4: 20,
  w13: 35,
  wYtd: 20,
  wRs: 15,
  wTrend: 10,
};

/** Adjacent scores closer than this are flagged as a close call. */
export const CLOSE_CALL_GAP = 2;

export type ScoredItem = MomentumItem & {
  score: number;
  /** 1 = best among the items that have data for that factor; ties share the
   *  average of their positions, so ranks can be fractional (e.g. 1.5). */
  ranks: Partial<Record<FactorKey, number>>;
  /** How many items had data for that factor (the rank's denominator). */
  counts: Partial<Record<FactorKey, number>>;
  closeCall: boolean;
};

export type MomentumBoard = {
  /** Sorted by score, best first. */
  rows: ScoredItem[];
  /** Allocation-weighted composite of the scored rows (0..100). */
  health: number | null;
};

const FACTOR_WEIGHT: [FactorKey, keyof MomentumWeights][] = [
  ["ret4w", "w4"],
  ["ret13w", "w13"],
  ["retYtd", "wYtd"],
];

export function scoreUniverse(
  items: MomentumItem[],
  weights: MomentumWeights,
): MomentumBoard {
  // Ordinal ranks per factor, computed over the items that have the factor.
  // Equal values share the average of the positions they span (1-based), so a
  // tie is worth the same to both holdings instead of whatever the sort
  // happened to decide.
  const ranks = items.map<Partial<Record<FactorKey, number>>>(() => ({}));
  const counts: Partial<Record<FactorKey, number>> = {};
  for (const [key] of FACTOR_WEIGHT) {
    const withData = items
      .map((it, index) => ({ value: it[key], index }))
      .filter((e): e is { value: number; index: number } => e.value != null)
      .sort((a, b) => b.value - a.value);
    counts[key] = withData.length;
    let i = 0;
    while (i < withData.length) {
      let j = i;
      while (j + 1 < withData.length && withData[j + 1].value === withData[i].value) {
        j += 1;
      }
      const shared = (i + 1 + (j + 1)) / 2;
      for (let k = i; k <= j; k += 1) ranks[withData[k].index][key] = shared;
      i = j + 1;
    }
  }

  const scored: ScoredItem[] = [];
  items.forEach((it, index) => {
    let total = 0;
    let used = 0;
    for (const [key, wKey] of FACTOR_WEIGHT) {
      const rank = ranks[index][key];
      const n = counts[key] ?? 0;
      const w = Math.max(0, weights[wKey]);
      if (rank == null || n === 0 || w === 0) continue;
      const norm = n <= 1 ? 1 : (n - rank) / (n - 1);
      total += w * norm;
      used += w;
    }
    // Binary factors: full credit when true, none when false, and a neutral
    // half-credit when unknown — "no data" must not outrank "known bad".
    const binary = (flag: boolean | null, w: number) => {
      if (w <= 0) return;
      total += flag == null ? w / 2 : flag ? w : 0;
      used += w;
    };
    binary(it.rs != null ? it.rs > 0 : null, Math.max(0, weights.wRs));
    binary(it.above200, Math.max(0, weights.wTrend));
    if (used <= 0) return;
    scored.push({
      ...it,
      score: Math.round((total / used) * 1000) / 10,
      ranks: ranks[index],
      counts,
      closeCall: false,
    });
  });

  scored.sort((a, b) => b.score - a.score);
  for (let i = 0; i < scored.length - 1; i++) {
    if (scored[i].score - scored[i + 1].score < CLOSE_CALL_GAP) {
      scored[i].closeCall = true;
      scored[i + 1].closeCall = true;
    }
  }

  const totalValue = scored.reduce((s, r) => s + Math.max(0, r.valueAzn), 0);
  const health =
    totalValue > 0
      ? Math.round(
          (scored.reduce((s, r) => s + r.score * Math.max(0, r.valueAzn), 0) /
            totalValue) *
            10,
        ) / 10
      : null;

  return { rows: scored, health };
}

/**
 * Strength bands for the portfolio's weighted momentum score. The source
 * sheet frames these as a stance to take (Defensive / Neutral / Aggressive);
 * the UI instead names what the number measures, since the score says nothing
 * about the fund's profit, risk or debt.
 */
export function healthLabel(health: number): {
  label: string;
  tone: "red" | "amber" | "green";
} {
  if (health < 50) return { label: "Zəif", tone: "red" };
  if (health < 70) return { label: "Orta", tone: "amber" };
  return { label: "Güclü", tone: "green" };
}

/**
 * Allocation-weighted 13W portfolio return. Uses current weights (positions
 * are assumed stable over the window, same simplification the day-change
 * math makes).
 */
export function portfolioRet13w(items: MomentumItem[]): number | null {
  const withData = items.filter((i) => i.ret13w != null && i.valueAzn > 0);
  const totalValue = withData.reduce((s, i) => s + i.valueAzn, 0);
  if (totalValue <= 0) return null;
  return (
    withData.reduce((s, i) => s + (i.ret13w as number) * i.valueAzn, 0) /
    totalValue
  );
}

/** Allocation-weighted 13W portfolio return minus SPY's — the alpha pill. */
export function portfolioAlpha13w(
  items: MomentumItem[],
  spyRet13w: number | null,
): number | null {
  if (spyRet13w == null) return null;
  const portfolio = portfolioRet13w(items);
  return portfolio == null ? null : portfolio - spyRet13w;
}
