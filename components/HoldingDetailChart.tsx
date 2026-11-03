"use client";

import { useState, type PointerEvent } from "react";

// The Fond Portfeli drill-down's price chart: the picked window (1G … 5 İL)
// drawn large, against the holding's average purchase price as a dashed
// reference line — "where is it now vs what we paid". Pure SVG like
// RowSpark; hovering (or touch-dragging) reads the exact price at any point.
//
// The svg stretches (preserveAspectRatio=none) to fill the box, so the line
// keeps a fixed stroke via non-scaling-stroke, and every round or textual
// mark (last-price dot, both labels) is HTML positioned by percent — an
// svg circle or <text> would smear with the stretch.

const H = 100;
const PAD = 8;

export function HoldingDetailChart({
  values,
  avgPrice,
  up: upOverride,
  id,
  format,
}: {
  /** The window's closes (USD), oldest first. */
  values: number[];
  /** Average purchase price in the same unit; null draws no reference. */
  avgPrice: number | null;
  /** Tint override (Günlük follows the day badge); null tints by the
   *  series' own first→last move. */
  up?: boolean | null;
  id: string;
  /** Price formatter for the two labels (USD or AZN view). */
  format: (usd: number) => string;
}) {
  // Index of the point under the pointer; null when not hovering.
  const [hover, setHover] = useState<number | null>(null);
  if (values.length < 2) return null;
  const up = upOverride ?? values[values.length - 1] >= values[0];

  // The reference line joins the y-domain so it stays on the plot even when
  // the whole window traded above (or below) the purchase price.
  const ref = avgPrice != null && avgPrice > 0 ? avgPrice : null;
  const lo = Math.min(...values, ref ?? Infinity);
  const hi = Math.max(...values, ref ?? -Infinity);
  const span = hi - lo || 1;
  const y = (v: number) => H - PAD - ((v - lo) / span) * (H - PAD * 2);
  const step = 100 / (values.length - 1);
  const line = values
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(2)} ${y(v).toFixed(2)}`)
    .join(" ");
  const last = values[values.length - 1];
  const lastY = y(last);
  const refY = ref != null ? y(ref) : null;

  const pick = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (r.width <= 0) return;
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    setHover(Math.round(f * (values.length - 1)));
  };
  // A window switch can shrink the series under a stale index.
  const hIdx = hover == null ? null : Math.min(hover, values.length - 1);
  const hx = hIdx == null ? 0 : hIdx * step;
  const hy = hIdx == null ? 0 : y(values[hIdx]);

  return (
    <div
      className={`relative pb-5 ${
        up
          ? "text-brand-green dark:text-emerald-400"
          : "text-brand-red dark:text-red-400"
      }`}
    >
      {/* L-shaped axes as the plot box's own left/bottom borders. */}
      {/* touch-pan-y: a horizontal finger drag scrubs the price, a vertical
          one still scrolls the page. */}
      <div
        className="relative h-28 cursor-crosshair touch-pan-y border-b border-l border-black/15 dark:border-white/20 sm:h-32"
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={() => setHover(null)}
        onPointerCancel={() => setHover(null)}
      >
        <svg
          aria-hidden
          viewBox={`0 0 100 ${H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.16" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${line} L100 ${H} L0 ${H} Z`} fill={`url(#${id})`} />
          <path
            d={line}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {refY != null && ref != null && (
          <div
            className="pointer-events-none absolute inset-x-0"
            style={{ top: `${refY}%` }}
            title="Ortalama alış qiyməti"
          >
            <div className="border-t border-dashed border-black/35 dark:border-white/40" />
            {/* Label above the line unless the line hugs the top edge. */}
            <span
              className={`num absolute left-1.5 text-[10px] font-medium text-black/60 dark:text-white/70 ${
                refY < 18 ? "top-0.5" : "bottom-0.5"
              }`}
            >
              {format(ref)}
            </span>
          </div>
        )}

        {hIdx != null && (
          <>
            {/* Hover guide + point + price bubble; the bubble anchors to
                the nearer edge near the plot's ends so it never clips. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 w-px bg-current opacity-40"
              style={{ left: `${hx}%` }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current ring-2 ring-white dark:ring-[#0f1a14]"
              style={{ left: `${hx}%`, top: `${hy}%` }}
            />
            <span
              className={`num pointer-events-none absolute z-10 whitespace-nowrap rounded-md border border-black/10 bg-white/95 px-1.5 py-0.5 text-[11px] font-semibold text-black/85 shadow-sm dark:border-white/15 dark:bg-[#0f1a14]/95 dark:text-white/90 ${
                hx < 15 ? "" : hx > 85 ? "-translate-x-full" : "-translate-x-1/2"
              } ${hy < 30 ? "translate-y-2" : "-translate-y-[calc(100%+8px)]"}`}
              style={{ left: `${hx}%`, top: `${hy}%` }}
            >
              {format(values[hIdx])}
            </span>
          </>
        )}

        {/* Latest value: a round HTML dot on the right edge. */}
        <span
          aria-hidden
          className="absolute right-0 h-2 w-2 -translate-y-1/2 translate-x-1/2 rounded-full bg-current ring-2 ring-white dark:ring-[#0f1a14]"
          style={{ top: `${lastY}%` }}
        />
      </div>
      {/* The latest price, under the axis, right-aligned to the dot (kept
          inside the box so it never pokes into the stats column). */}
      <span className="num absolute bottom-0 right-0 text-[10px] font-semibold">
        {format(last)}
      </span>
    </div>
  );
}
