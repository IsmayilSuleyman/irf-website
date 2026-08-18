import type {} from "react";

// The shared month sparkline used by Aktivlərim and Fond Portfeli rows —
// drawn as a BACKDROP across the row (the ticker-tile treatment) so it
// costs no horizontal space: a soft gradient wash and a quiet line behind
// the content, tinted by the month's direction. Pure SVG.

/** Normalize a series into an SVG path over a w×h box (padded vertically). */
export function sparkPath(
  values: number[],
  w: number,
  h: number,
  pad: number,
): string {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = w / (values.length - 1);
  return values
    .map(
      (v, i) =>
        `${i === 0 ? "M" : "L"}${(i * step).toFixed(2)} ${(
          h - pad - ((v - min) / span) * (h - pad * 2)
        ).toFixed(2)}`,
    )
    .join(" ");
}

export function RowSpark({ values, id }: { values: number[]; id: string }) {
  const line = sparkPath(values, 100, 30, 3);
  if (!line) return null;
  const up = values[values.length - 1] >= values[0];
  return (
    <svg
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      aria-hidden
      className={`pointer-events-none absolute inset-x-0 bottom-0 h-3/4 w-full ${
        up
          ? "text-brand-green dark:text-emerald-400"
          : "text-brand-red dark:text-red-400"
      }`}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.12" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L100 30 L0 30 Z`} fill={`url(#${id})`} />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.4"
      />
    </svg>
  );
}
