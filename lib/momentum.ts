// Momentum ranking engine — client-safe port of the ETF-Momentum sheet's
// Rankings logic. Each factor value becomes an ordinal rank among the
// holdings that have data for it, ranks normalize to 0..1 via (N−rank)/(N−1),
// and the composite is the weighted mean of the available factors ×100.
// Unlike the sheet, missing factors renormalize the weight base instead of
// producing degenerate scores, so a young ETF with no YTD history competes
// fairly on its remaining factors.

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

export type FactorKey = "ret4w" | "ret13w" | "retYtd" | "rs";

export type MomentumWeights = {
  w4: number;
  w13: number;
  wYtd: number;
  wRs: number;
  wTrend: number;
};

/** The sheet's model weights: 4W 30 / 13W 25 / YTD 20 / RS 15 / 200DMA 10. */
export const DEFAULT_WEIGHTS: MomentumWeights = {
  w4: 30,
  w13: 25,
  wYtd: 20,
  wRs: 15,
  wTrend: 10,
};

/** Adjacent scores closer than this are flagged as a close call. */
export const CLOSE_CALL_GAP = 2;

export type ScoredItem = MomentumItem & {
  score: number;
  /** 1 = best among the items that have data for that factor. */
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
  ["rs", "wRs"],
];

export function scoreUniverse(
  items: MomentumItem[],
  weights: MomentumWeights,
): MomentumBoard {
  // Ordinal ranks per factor, computed over the items that have the factor.
  const ranks = items.map<Partial<Record<FactorKey, number>>>(() => ({}));
  const counts: Partial<Record<FactorKey, number>> = {};
  for (const [key] of FACTOR_WEIGHT) {
    const withData = items
      .map((it, index) => ({ value: it[key], index }))
      .filter((e): e is { value: number; index: number } => e.value != null)
      .sort((a, b) => b.value - a.value);
    counts[key] = withData.length;
    withData.forEach((e, i) => {
      ranks[e.index][key] = i + 1;
    });
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
    const wTrend = Math.max(0, weights.wTrend);
    if (it.above200 != null && wTrend > 0) {
      total += it.above200 ? wTrend : 0;
      used += wTrend;
    }
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

/** The sheet's health bands: <50 Müdafiə, 50–70 Neytral, ≥70 Hücum. */
export function healthLabel(health: number): {
  label: string;
  tone: "red" | "amber" | "green";
} {
  if (health < 50) return { label: "Müdafiə", tone: "red" };
  if (health < 70) return { label: "Neytral", tone: "amber" };
  return { label: "Hücum", tone: "green" };
}

/**
 * Allocation-weighted 13W portfolio return minus SPY's — the alpha pill.
 * Uses current weights (positions are assumed stable over the window, same
 * simplification the day-change math makes).
 */
export function portfolioAlpha13w(
  items: MomentumItem[],
  spyRet13w: number | null,
): number | null {
  if (spyRet13w == null) return null;
  const withData = items.filter((i) => i.ret13w != null && i.valueAzn > 0);
  const totalValue = withData.reduce((s, i) => s + i.valueAzn, 0);
  if (totalValue <= 0) return null;
  const portfolio =
    withData.reduce((s, i) => s + (i.ret13w as number) * i.valueAzn, 0) /
    totalValue;
  return portfolio - spyRet13w;
}
