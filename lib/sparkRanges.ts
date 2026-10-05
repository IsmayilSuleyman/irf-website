// The row sparklines' three windows (Aktivlərim + Fond Portfeli): the
// latest session's intraday curve, half a year and a full year of daily
// closes. Pure and client-safe — the dashboard builds the series server
// side, the lists' SparkRangeToggle picks which one each row draws.

export type SparkRange = "day" | "half" | "year";

export const SPARK_RANGES: { key: SparkRange; label: string; title: string }[] =
  [
    { key: "day", label: "GÜNLÜK", title: "Son seansın gedişi" },
    { key: "half", label: "YARIMİLLİK", title: "Son 6 ay" },
    { key: "year", label: "İLLİK", title: "Son 1 il" },
  ];

export const DEFAULT_SPARK_RANGE: SparkRange = "day";

/** One row's series per window; a missing or too-short one draws no line. */
export type RowSparkSet = Partial<Record<SparkRange, number[]>>;

/** The windows at least one row can draw, in pill order. */
export function availableSparkRanges(
  sets: Array<RowSparkSet | undefined>,
): SparkRange[] {
  return SPARK_RANGES.map((r) => r.key).filter((k) =>
    sets.some((s) => (s?.[k]?.length ?? 0) > 1),
  );
}

/**
 * The window a list opens on: Günlük when any row has it, else the first
 * window some row can draw — a failed intraday fetch must not open the
 * list on blank rows. Pure in the props, so SSR and hydration agree.
 */
export function initialSparkRange(
  sets: Array<RowSparkSet | undefined>,
): SparkRange {
  const ok = availableSparkRanges(sets);
  return ok.includes(DEFAULT_SPARK_RANGE)
    ? DEFAULT_SPARK_RANGE
    : (ok[0] ?? DEFAULT_SPARK_RANGE);
}

const DAY_MS = 86_400_000;
export const HALF_YEAR_DAYS = 183;
export const YEAR_DAYS = 365;

// Densest series a row needs: the sparkline is ≤160px wide, and ≤190
// points is about the density of the old six-month daily rows — a year of
// closes (or a day of 2-minute İRF snapshots) thins to it instead of
// turning to fuzz.
const MAX_POINTS = 190;

/**
 * At most `max` points, evenly strided BACK from the newest value so the
 * latest-value dot always marks a real point; the oldest few may drop.
 */
export function thinSeries(values: number[], max: number): number[] {
  if (values.length <= max || max < 2) return values;
  const stride = Math.ceil(values.length / max);
  const out: number[] = [];
  for (let i = values.length - 1; i >= 0; i -= stride) out.push(values[i]);
  return out.reverse();
}

/**
 * Payload-ready sparkline series: thinned, rounded to 5 significant digits
 * (the series ride the RSC payload — full floats double its weight for no
 * visible difference) and cleared of non-finite values.
 */
export function toSpark(values: number[]): number[] {
  return thinSeries(
    values.filter((v) => Number.isFinite(v)),
    MAX_POINTS,
  ).map((v) => Number(v.toPrecision(5)));
}

/**
 * The Yarımillik and İllik slices of an ascending daily series, windowed
 * on the wall clock (server side only, so no hydration skew). `t` is an
 * ISO date or timestamp; unreadable dates drop out.
 */
export function dailySparkWindows(
  points: Array<{ t: string; v: number }>,
  nowMs: number,
): Pick<RowSparkSet, "half" | "year"> {
  const dated = points
    .map((p) => ({ ms: Date.parse(p.t), v: p.v }))
    .filter((p) => Number.isFinite(p.ms));
  const since = (days: number) =>
    toSpark(dated.filter((p) => p.ms >= nowMs - days * DAY_MS).map((p) => p.v));
  return { half: since(HALF_YEAR_DAYS), year: since(YEAR_DAYS) };
}

const HOUR_MS = 3_600_000;
// A flat stretch this long is a closed market (the overnight gap carries
// the after-market close; weekends carry Friday's), not a quiet session.
const CLOSED_GAP_MS = 3 * HOUR_MS;

/**
 * The İRF pay price's Günlük window, from the minute-snapshot tiers
 * (finest first): the latest SESSION, like the ETF rows' intraday curves.
 * The recorder writes around the clock but the price only moves while a
 * US session prints, so the window ends at the price's LAST MOVE (a
 * weekend still draws Friday, not a flat line) and starts where the
 * closed-market gap before it ends (so the curve opens at the previous
 * close's level). The first tier that reaches 24h back from the last move
 * wins; the coarsest one is used as far as it goes.
 */
export function latestSessionSpark(
  tiers: Array<Array<{ date: string; value: number }>>,
): number[] {
  for (let t = 0; t < tiers.length; t++) {
    const pts = tiers[t]
      .map((p) => ({ ms: Date.parse(p.date), v: p.value }))
      .filter((p) => Number.isFinite(p.ms) && Number.isFinite(p.v));
    if (pts.length < 2) continue;
    // Recomputed prices can carry float noise — "unchanged" is relative.
    const same = (a: number, b: number) =>
      Math.abs(a - b) <= Math.abs(b) * 1e-7;
    let end = pts.length - 1;
    while (end > 0 && same(pts[end - 1].v, pts[end].v)) end--;
    if (end === 0) continue; // flat across the whole tier — look further back
    const from = pts[end].ms - 24 * HOUR_MS;
    const isLast = t === tiers.length - 1;
    if (pts[0].ms > from && !isLast) continue; // tier too short — go coarser
    const win = pts.filter((p, i) => i <= end && p.ms >= from);
    // Open at the end of the latest closed-market gap inside the window.
    let start = 0;
    let runStart = 0;
    for (let i = 1; i < win.length; i++) {
      if (same(win[i].v, win[i - 1].v)) continue;
      if (win[i - 1].ms - win[runStart].ms >= CLOSED_GAP_MS) start = i - 1;
      runStart = i;
    }
    return toSpark(win.slice(start).map((p) => p.v));
  }
  return [];
}
