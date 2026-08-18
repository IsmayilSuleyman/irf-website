import type {} from "react";

// The shared mid-row month sparkline used by Aktivlərim and Fond Portfeli:
// a small gradient curve over the row's empty middle, tinted by the
// month's direction. Pure SVG — no client machinery of its own.

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
      className={`h-7 w-14 shrink-0 self-center sm:h-8 sm:w-24 ${
        up
          ? "text-brand-green dark:text-emerald-400"
          : "text-brand-red dark:text-red-400"
      }`}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L100 30 L0 30 Z`} fill={`url(#${id})`} />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
    </svg>
  );
}
