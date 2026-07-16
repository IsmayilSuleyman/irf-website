// Pure, dependency-free helpers for the 10-minute session-history snapshots
// (extended_hours_history table). Client-safe: imported by the hover-chart
// components as values, so nothing server-side may live in this module.

export type SessionMode = "pre" | "post" | "regular";

export type SessionHistoryPoint = {
  /** Bucket start, ISO timestamp. */
  t: string;
  /** Fraction, e.g. 0.0103. */
  changePct: number;
  mode: SessionMode;
};

/**
 * Keep only the newest contiguous session: points within `windowHours` of
 * the latest one. 6h suits pre (5.5h) and post (4h); the regular session is
 * 6.5h, so callers pass 8.
 */
export function latestSessionTail(
  points: SessionHistoryPoint[],
  windowHours = 6,
): SessionHistoryPoint[] {
  if (points.length === 0) return points;
  const lastMs = new Date(points[points.length - 1].t).getTime();
  const cutoff = lastMs - windowHours * 60 * 60 * 1000;
  return points.filter((p) => new Date(p.t).getTime() >= cutoff);
}
