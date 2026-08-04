import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScoredItem } from "@/lib/momentum";
import type { WeekScores } from "@/lib/buyTicket";

// Server side of the weekly momentum snapshot. The pure ticket logic lives in
// lib/buyTicket.ts; this module only moves rows in and out of Supabase.
//
// The write is best-effort and admin-gated in the database: the fund admin's
// dashboard render records the week, first-write-wins makes every later render
// that week a no-op, and a failure never reaches the page. That is the same
// render-triggered model the session snapshots use — the hosting plan has no
// spare cron slot.

/** How many weeks of history the hysteresis replay reads. Sized for the
 *  monthly cadence too: ~7 months of weekly snapshots, so the month-average
 *  fold always has a full run-up. Still a three-figure row count. */
export const HISTORY_WEEKS = 32;

/**
 * A snapshot is only worth cementing if the board looks complete: the Sheets
 * read can return an empty snapshot on failure, and the reference columns can
 * be blank, either of which would lock a wrong week of advice.
 */
export const MIN_SNAPSHOT_ROWS = 5;

const DAY_MS = 86_400_000;
/** Baku is UTC+4 year-round — no DST to track. */
const BAKU_OFFSET_MS = 4 * 60 * 60 * 1000;

/** Current ISO Monday in Asia/Baku as "YYYY-MM-DD". */
export function currentBakuWeekStart(now: Date = new Date()): string {
  const baku = now.getTime() + BAKU_OFFSET_MS;
  const dow = new Date(baku).getUTCDay(); // 0 = Sunday
  const sinceMonday = (dow + 6) % 7;
  return new Date(baku - sinceMonday * DAY_MS).toISOString().slice(0, 10);
}

/** Current calendar month in Asia/Baku as "YYYY-MM" — NOT derived from the
 *  week start, whose Monday can fall in the previous month at a boundary. */
export function currentBakuMonthKey(now: Date = new Date()): string {
  return new Date(now.getTime() + BAKU_OFFSET_MS).toISOString().slice(0, 7);
}

/**
 * Record this week's scores. Silently does nothing when the caller is not the
 * fund admin (the RPC raises 42501) or when the board looks degraded — both
 * are normal, not errors worth surfacing on the dashboard.
 */
export async function recordMomentumWeek(
  supabase: SupabaseClient,
  rows: ScoredItem[],
  opts: { factorsComplete: boolean },
): Promise<void> {
  // A missing SPY reference nulls the relative-strength factor for every row,
  // which shifts every score. Never cement a week computed that way.
  if (!opts.factorsComplete) return;
  if (rows.length < MIN_SNAPSHOT_ROWS) return;

  const ordered = [...rows].sort((a, b) => b.score - a.score);
  const payload = ordered.map((r, i) => ({
    symbol: r.symbol,
    score: r.score,
    rank: i + 1,
    closeCall: r.closeCall,
    // Exit facts for the sell side's confirmation history.
    above200: r.above200,
    beatsSpy: r.rs != null ? r.rs > 0 : null,
    ret13w: r.ret13w,
    ret4w: r.ret4w,
  }));

  const { error } = await supabase.rpc("record_momentum_week", {
    p_rows: payload,
  });
  // 42501 is the expected outcome for every non-admin render; only log the rest.
  if (error && error.code !== "42501") {
    console.error("[momentum-week] snapshot record failed:", error.message);
  }
}

/** Past weekly snapshots, oldest first, grouped per week. */
export async function fetchMomentumWeeks(
  supabase: SupabaseClient,
  weeks: number = HISTORY_WEEKS,
): Promise<WeekScores[]> {
  const since = new Date(Date.now() - weeks * 7 * DAY_MS)
    .toISOString()
    .slice(0, 10);
  const { data, error } = await supabase
    .from("momentum_week_history")
    .select("week_start, symbol, score, above_200, beats_spy, ret_13w, ret_4w")
    .gte("week_start", since)
    .order("week_start", { ascending: true });

  if (error) {
    console.error("[momentum-week] history fetch failed:", error.message);
    return [];
  }

  // PostgREST returns numeric as a JSON string; booleans arrive as booleans
  // (or null on pre-facts rows).
  const num = (v: unknown): number | null => {
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const bool = (v: unknown): boolean | null => (v == null ? null : Boolean(v));

  const byWeek = new Map<string, WeekScores>();
  for (const row of data ?? []) {
    const weekStart = String(row.week_start);
    const symbol = String(row.symbol);
    const score = Number(row.score);
    if (!Number.isFinite(score)) continue;
    let bucket = byWeek.get(weekStart);
    if (!bucket) {
      bucket = { weekStart, scores: {}, facts: {} };
      byWeek.set(weekStart, bucket);
    }
    bucket.scores[symbol] = score;
    bucket.facts![symbol] = {
      above200: bool(row.above_200),
      beatsSpy: bool(row.beats_spy),
      ret13w: num(row.ret_13w),
      ret4w: num(row.ret_4w),
    };
  }
  return [...byWeek.values()].sort((a, b) =>
    a.weekStart < b.weekStart ? -1 : 1,
  );
}

/**
 * History with the live board standing in for a current week that has no
 * stored snapshot yet. Once the week's write HAS landed, the stored row wins:
 * letting live intraday scores override it would let a challenger's third
 * qualifying week appear on Tuesday and vanish on Thursday — the verdict
 * would flap on exactly the noise the hysteresis exists to filter. The live
 * fallback only covers the gap before the snapshot lands (cron at Monday
 * 00:00 Baku, or the first admin render).
 */
export function withCurrentWeek(
  history: WeekScores[],
  rows: ScoredItem[],
  weekStart: string,
): WeekScores[] {
  if (rows.length === 0) return history;
  if (history.some((w) => w.weekStart === weekStart)) return history;
  const scores: Record<string, number> = {};
  const facts: WeekScores["facts"] = {};
  for (const r of rows) {
    scores[r.symbol] = r.score;
    facts[r.symbol] = {
      above200: r.above200,
      beatsSpy: r.rs != null ? r.rs > 0 : null,
      ret13w: r.ret13w,
      ret4w: r.ret4w,
    };
  }
  return [...history, { weekStart, scores, facts }].sort((a, b) =>
    a.weekStart < b.weekStart ? -1 : 1,
  );
}
