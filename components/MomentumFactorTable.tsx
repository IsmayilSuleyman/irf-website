"use client";

import { Fragment } from "react";
import {
  type FactorKey,
  type MomentumWeights,
  type ScoredItem,
} from "@/lib/momentum";
import { formatUsd } from "@/lib/portfolio";

// Momentum factor UI shared bits: the Fond Portfeli drill-down cards plus
// the factor/label/tone constants they build on.

// Only the ordinal (ranked) factors — relative strength became a binary
// beats-the-index flag (ranking a constant shift of 13W was the 13W ranking
// again), so it renders like the 200-day line below, not as a rank row.
export const FACTORS: {
  key: FactorKey;
  short: string;
  full: string;
  weightKey: keyof MomentumWeights;
}[] = [
  { key: "ret4w", short: "4H", full: "4 həftəlik gəlir", weightKey: "w4" },
  { key: "ret13w", short: "13H", full: "13 həftəlik gəlir", weightKey: "w13" },
  { key: "retYtd", short: "YTD", full: "İlin əvvəlindən gəlir", weightKey: "wYtd" },
];

export const fmtPct = (v: number) =>
  `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;

/** Pill classes (tinted bg + text) for a score chip: green ≥66, amber ≥33,
 *  red below. */
export function scorePill(score: number): string {
  if (score >= 66)
    return "bg-brand-green/15 text-brand-green dark:text-emerald-400";
  if (score >= 33) return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  return "bg-brand-red/15 text-brand-red dark:text-red-400";
}

// Ordinal with Azerbaijani vowel harmony for rank phrases ("15-ci yer").
// Last digit decides the suffix; numbers ending in 0 take the tens' form
// (10-cu, 20-ci, 30-cu, 40-cı, 50-ci, 60-cı, 70-ci, 80-cı, 90-cı).
const ORDINAL_TENS: Record<number, string> = {
  10: "cu",
  20: "ci",
  30: "cu",
  40: "cı",
  50: "ci",
  60: "cı",
  70: "ci",
  80: "cı",
  90: "cı",
};
const ORDINAL_DIGITS: Record<number, string> = {
  1: "ci",
  2: "ci",
  3: "cü",
  4: "cü",
  5: "ci",
  6: "cı",
  7: "ci",
  8: "ci",
  9: "cu",
};
export function azOrdinal(n: number): string {
  const suffix =
    n % 10 === 0 ? (ORDINAL_TENS[n % 100] ?? "cu") : ORDINAL_DIGITS[n % 10];
  return `${n}-${suffix}`;
}

/** Tinted value pill, sized so every row's pill lines up in one column. */
function ValuePill({
  children,
  tone,
  title,
}: {
  children: React.ReactNode;
  tone: "up" | "down" | "muted";
  title?: string;
}) {
  const cls =
    tone === "up"
      ? "border-transparent bg-brand-green/15 text-brand-green dark:text-emerald-400"
      : tone === "down"
        ? "border-transparent bg-brand-red/15 text-brand-red dark:text-red-400"
        : "border-transparent bg-black/5 text-black/45 dark:bg-white/10 dark:text-white/50";
  return (
    <span
      title={title}
      className={`num inline-flex min-w-[3.6rem] justify-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${cls}`}
    >
      {children}
    </span>
  );
}

/**
 * Factor breakdown for the holdings drill-down, one compact line per
 * factor: label · value pill, the pills aligned in one right-hand column
 * beside the drill-down's price chart. The detail that used to fill a
 * middle column — the rank ("23 pozisiyadan 13-cü"), the S&P 500 verdict,
 * the price-vs-200GO comparison — rides each pill's hover title instead.
 * No weights here — those belong to the Momentum section where they are
 * adjustable.
 */
export function MomentumFactorRows({
  row,
  className = "",
}: {
  row: ScoredItem;
  className?: string;
}) {
  const LABEL = "text-[11px] text-black/45 dark:text-white/50";

  return (
    <div
      className={`grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 ${className}`}
    >
      {FACTORS.map((f) => {
        const value = row[f.key];
        const rank = row.ranks[f.key];
        const n = row.counts[f.key] ?? 0;
        return (
          <Fragment key={f.key}>
            <span className={LABEL}>{f.full}:</span>
            <ValuePill
              tone={value == null ? "muted" : value >= 0 ? "up" : "down"}
              title={
                value != null && rank != null
                  ? `${n} pozisiyadan ${azOrdinal(rank)}`
                  : "məlumat yoxdur"
              }
            >
              {value == null ? "—" : fmtPct(value)}
            </ValuePill>
          </Fragment>
        );
      })}

      {/* The benchmark is the SPY ETF but is named for its index everywhere
          in the UI. */}
      <span className={LABEL}>S&P 500-ə nisbi güc:</span>
      {row.rs == null ? (
        <ValuePill tone="muted" title="məlumat yoxdur">
          —
        </ValuePill>
      ) : (
        <ValuePill
          tone={row.rs >= 0 ? "up" : "down"}
          title={`13 həftədə S&P 500-dən ${row.rs >= 0 ? "üstün" : "geridə"}`}
        >
          {fmtPct(row.rs)}
        </ValuePill>
      )}

      <span className={LABEL}>200 günlük ortalama:</span>
      {row.avg200Usd == null ? (
        <ValuePill tone="muted" title="məlumat yoxdur">
          —
        </ValuePill>
      ) : (
        <ValuePill
          tone={row.above200 ? "up" : "down"}
          title={`${formatUsd(row.priceUsd)} ${row.above200 ? ">" : "<"} ${formatUsd(row.avg200Usd)}`}
        >
          {row.above200 ? "üzərində" : "altında"}
        </ValuePill>
      )}
    </div>
  );
}
