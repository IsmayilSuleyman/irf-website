import type {} from "react";

// The shared row sparkline used by Aktivlərim and Fond Portfeli — one of
// three windows (Günlük / Yarımillik / İllik, picked by SparkRangeToggle)
// drawn as a fixed-width mini-chart anchored on the RIGHT, ending just
// before the numbers columns (İsmayıl's ask: the graph lives beside the
// figures, not smeared from the row's left edge). Drawn as a backdrop
// (pointer-events-none, behind the content) with the LEFT edge faded so
// it blends into the row; the right edge stays crisp — recent movement
// is the point — and is tipped with a dot at the latest value. Tinted by
// the period's direction, unless the caller passes `up` (Günlük follows
// the day badge — vs the previous close, like the ticker tiles). Pure SVG.

/**
 * Pins a control (the range toggle) above the sparkline column from sm up:
 * its right edge on the curve's right edge. Phones keep it in flow (flex,
 * so the pill centers like the ₼/$ pills instead of riding a text line).
 * Keep in step with RowSpark's own right offsets below.
 */
export const ABOVE_SPARK =
  "flex items-center sm:absolute sm:inset-y-0 sm:right-44";

// A switched window's fresh sparkline fades in. Script-driven on purpose:
// a CSS animation restarts whenever React MOVES the node (every re-sort
// would flicker the list). React re-runs ref callbacks on moved rows too,
// so each node is remembered and fades exactly once. No hooks, so server
// components can still import sparkPath from this module.
const fadedSparks = new WeakSet<Element>();
function fadeInOnMount(el: HTMLSpanElement | null) {
  if (!el || fadedSparks.has(el) || typeof el.animate !== "function") return;
  fadedSparks.add(el);
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  el.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: 220,
    easing: "ease-out",
  });
}

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

export function RowSpark({
  values,
  id,
  up: upOverride,
  fadeIn = false,
}: {
  values: number[];
  id: string;
  /** Tint override; null/omitted tints by the series' own first→last move. */
  up?: boolean | null;
  /** Fade in on mount — set after a window switch, never on first paint
   *  (a hydration-time fade would blink the server-rendered line out). */
  fadeIn?: boolean;
}) {
  const line = sparkPath(values, 100, 30, 3);
  if (!line) return null;
  const up = upOverride ?? values[values.length - 1] >= values[0];
  // The latest value's y, from the same normalization sparkPath uses.
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  const lastY = 30 - 3 - ((values[values.length - 1] - min) / span) * 24;
  return (
    // The right offsets clear the widest tile-figure numbers grid
    // (auto + 56px cols on phones, auto + 64px from sm up), so the curve
    // never runs beneath the value/price figures; the fixed width keeps
    // every row's chart the same size, aligned like a column.
    <span
      aria-hidden
      ref={fadeIn ? fadeInOnMount : undefined}
      className={`pointer-events-none absolute bottom-1 right-36 h-3/4 w-24 sm:right-44 sm:w-40 ${
        up
          ? "text-brand-green dark:text-emerald-400"
          : "text-brand-red dark:text-red-400"
      }`}
    >
      <svg
        viewBox="0 0 100 30"
        preserveAspectRatio="none"
        className="h-full w-full"
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.12" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
          {/* Left-only fade: the final stop carries to the right edge, so the
              newest stretch of the line renders at full strength. */}
          <linearGradient id={`${id}-fade`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fff" stopOpacity="0" />
            <stop offset="14%" stopColor="#fff" />
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
      {/* The latest-value dot lives OUTSIDE the stretched svg
          (preserveAspectRatio=none turned a circle into an ellipse) —
          a fixed-size HTML dot stays perfectly round. */}
      <span
        className="absolute right-0 h-[5px] w-[5px] -translate-y-1/2 translate-x-1/2 rounded-full bg-current opacity-90"
        style={{ top: `${(lastY / 30) * 100}%` }}
      />
    </span>
  );
}
