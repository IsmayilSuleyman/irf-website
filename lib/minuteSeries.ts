import type { SupabaseClient } from "@supabase/supabase-js";

// The minutely snapshot series, downsampled in-database for the three
// fine chart windows. Each point carries the pay price, the fund total
// and (when a holder is named) that holder's combined value — İRF slice
// plus their ETF book — exactly what the recorder wrote each minute.

export type MinutePoint = {
  label: string;
  value: number;
  date: string;
};

export type MinuteTier = {
  price: MinutePoint[];
  fund: MinutePoint[];
  /** The named holder's combined value; empty when the recorder had no
   *  row for them (or no holder was requested). */
  mine: MinutePoint[];
};

export type MinuteSeries = {
  day: MinuteTier;
  week: MinuteTier;
  month: MinuteTier;
};

// Step/window per tier, tuned to keep every payload in the hundreds of
// points: a day of 2-minute buckets, a week of 10-minute buckets, a
// month of 30-minute buckets.
const TIERS = [
  { key: "day", step: 2, hours: 26 },
  { key: "week", step: 10, hours: 7 * 24 },
  { key: "month", step: 30, hours: 31 * 24 },
] as const;

type Row = {
  t: string;
  price: number | string | null;
  fund: number | string | null;
  holder_v: number | string | null;
};

function toTier(rows: Row[]): MinuteTier {
  const price: MinutePoint[] = [];
  const fund: MinutePoint[] = [];
  const mine: MinutePoint[] = [];
  for (const r of rows) {
    const date = String(r.t);
    const p = Number(r.price);
    const f = Number(r.fund);
    const v = r.holder_v == null ? null : Number(r.holder_v);
    if (Number.isFinite(p)) price.push({ label: "", value: p, date });
    if (Number.isFinite(f)) fund.push({ label: "", value: f, date });
    if (v != null && Number.isFinite(v)) mine.push({ label: "", value: v, date });
  }
  return { price, fund, mine };
}

/**
 * All three tiers in one parallel round; null when the table is empty or
 * unreachable (the charts then simply keep their daily-only ranges).
 */
export async function getMinuteSeries(
  supabase: SupabaseClient,
  holderName: string | null,
): Promise<MinuteSeries | null> {
  try {
    const results = await Promise.all(
      TIERS.map((t) =>
        supabase.rpc("get_minute_series", {
          p_step_minutes: t.step,
          p_hours: t.hours,
          p_holder: holderName,
        }),
      ),
    );
    const tiers = results.map((r) => {
      if (r.error) throw r.error;
      return toTier((r.data ?? []) as Row[]);
    });
    const [day, week, month] = tiers;
    if (
      day.price.length + week.price.length + month.price.length === 0
    ) {
      return null;
    }
    return { day, week, month };
  } catch (err) {
    console.error("[minute-series] fetch failed:", err);
    return null;
  }
}
