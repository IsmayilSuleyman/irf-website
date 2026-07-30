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

/** How many weeks of history the hysteresis replay reads. */
export const HISTORY_WEEKS = 20;

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
    .select("week_start, symbol, score")
    .gte("week_start", since)
    .order("week_start", { ascending: true });

  if (error) {
    console.error("[momentum-week] history fetch failed:", error.message);
    return [];
  }

  const byWeek = new Map<string, Record<string, number>>();
  for (const row of data ?? []) {
    const weekStart = String(row.week_start);
    // PostgREST returns numeric as a JSON string.
    const score = Number(row.score);
    if (!Number.isFinite(score)) continue;
    const bucket = byWeek.get(weekStart);
    if (bucket) bucket[String(row.symbol)] = score;
    else byWeek.set(weekStart, { [String(row.symbol)]: score });
  }
  return [...byWeek.entries()]
    .map(([weekStart, scores]) => ({ weekStart, scores }))
    .sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
}

/**
 * History with the live board folded in as the current week. The ticket must
 * not depend on the write having landed — the admin may not have loaded the
 * page yet, or the write may have failed — so the live scores always win for
 * the current week and the table supplies only past weeks.
 */
export function withCurrentWeek(
  history: WeekScores[],
  rows: ScoredItem[],
  weekStart: string,
): WeekScores[] {
  if (rows.length === 0) return history;
  const scores: Record<string, number> = {};
  for (const r of rows) scores[r.symbol] = r.score;
  return [...history.filter((w) => w.weekStart !== weekStart), { weekStart, scores }].sort(
    (a, b) => (a.weekStart < b.weekStart ? -1 : 1),
  );
}
