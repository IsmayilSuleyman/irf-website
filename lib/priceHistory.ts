import { createClient } from "@supabase/supabase-js";

export type NavPoint = {
  label: string;
  price: number;
  recordedAt: string; // ISO date
};

export async function getPriceHistory(): Promise<NavPoint[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { data, error } = await supabase
    .from("price_history")
    .select("label, price, recorded_at")
    .order("recorded_at", { ascending: true });

  if (error) console.error("Price history fetch error:", error);
  return (data ?? []).map((d) => ({
    label: d.label,
    price: Number(d.price),
    recordedAt: d.recorded_at,
  }));
}

export function findLatestPriceBeforeDate(
  history: NavPoint[],
  currentDate: Date,
): NavPoint | null {
  if (history.length === 0) return null;

  const currentDateLabel = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baku",
  }).format(currentDate);

  for (let i = history.length - 1; i >= 0; i -= 1) {
    const point = history[i];
    if (point.recordedAt < currentDateLabel) {
      return point;
    }
  }

  return null;
}

/**
 * Returns the price entry whose recorded_at is closest to (today − days).
 * Returns null if history is empty or has no entries that old.
 */
export function findPriceNDaysAgo(
  history: NavPoint[],
  days: number,
): NavPoint | null {
  if (history.length === 0) return null;
  const target = Date.now() - days * 24 * 60 * 60 * 1000;
  // Pick the entry with the smallest |recorded_at − target|, but only among
  // entries on or before the target (so "1 month ago" doesn't pick yesterday
  // when no older history exists).
  let best: NavPoint | null = null;
  let bestDelta = Infinity;
  for (const p of history) {
    const t = new Date(p.recordedAt).getTime();
    if (!Number.isFinite(t)) continue;
    if (t > target) continue;
    const delta = Math.abs(t - target);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = p;
    }
  }
  return best;
}

export type PeriodChange = {
  pct: number | null;
  pastPrice: number | null;
};

export type PeriodChanges = {
  w1: PeriodChange;
  m1: PeriodChange;
  m3: PeriodChange;
  y1: PeriodChange;
};

function changeFor(
  current: number,
  history: NavPoint[],
  days: number,
): PeriodChange {
  const past = findPriceNDaysAgo(history, days);
  if (!past || past.price <= 0) return { pct: null, pastPrice: null };
  return {
    pct: (current - past.price) / past.price,
    pastPrice: past.price,
  };
}

export function computePeriodChanges(
  current: number,
  history: NavPoint[],
): PeriodChanges {
  return {
    w1: changeFor(current, history, 7),
    m1: changeFor(current, history, 30),
    m3: changeFor(current, history, 90),
    y1: changeFor(current, history, 365),
  };
}
