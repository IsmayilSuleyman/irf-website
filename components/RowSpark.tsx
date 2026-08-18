import type {} from "react";

// The shared six-month sparkline used by Aktivlərim and Fond Portfeli
// rows — a fixed-width mini-chart anchored on the RIGHT, ending just
// before the numbers columns (İsmayıl's ask: the graph lives beside the
// figures, not smeared from the row's left edge). Drawn as a backdrop
// (pointer-events-none, behind the content) with both edges faded so it
// blends into the row, tinted by the period's direction. Pure SVG.

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
    // The right offsets clear the widest tile-figure numbers grid
    // (auto + 56px cols on phones, auto + 64px from sm up), so the curve
    // never runs beneath the value/price figures; the fixed width keeps
    // every row's chart the same size, aligned like a column.
    <svg
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      aria-hidden
      className={`pointer-events-none absolute bottom-1 right-36 h-3/4 w-24 sm:right-44 sm:w-40 ${
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
        <linearGradient id={`${id}-fade`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fff" stopOpacity="0" />
          <stop offset="12%" stopColor="#fff" />
          <stop offset="88%" stopColor="#fff" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={`${id}-mask`} maskUnits="userSpaceOnUse">
          <rect x="0" y="0" width="100" height="30" fill={`url(#${id}-fade)`} />
        </mask>
      </defs>
      <g mask={`url(#${id}-mask)`}>
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
      </g>
    </svg>
  );
}
