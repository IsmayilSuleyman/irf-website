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

export const FACTORS: {
  key: FactorKey;
  short: string;
  full: string;
  weightKey: keyof MomentumWeights;
}[] = [
  { key: "ret4w", short: "4H", full: "4 həftəlik gəlir", weightKey: "w4" },
  { key: "ret13w", short: "13H", full: "13 həftəlik gəlir", weightKey: "w13" },
  { key: "retYtd", short: "YTD", full: "İlin əvvəlindən gəlir", weightKey: "wYtd" },
  { key: "rs", short: "RS", full: "SPY-a nisbi güc", weightKey: "wRs" },
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
}: {
  children: React.ReactNode;
  tone: "up" | "down" | "muted";
}) {
  const cls =
    tone === "up"
      ? "border-transparent bg-brand-green/15 text-brand-green dark:text-emerald-400"
      : tone === "down"
        ? "border-transparent bg-brand-red/15 text-brand-red dark:text-red-400"
        : "border-transparent bg-black/5 text-black/45 dark:bg-white/10 dark:text-white/50";
  return (
    <span
      className={`num inline-flex min-w-[3.6rem] justify-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${cls}`}
    >
      {children}
    </span>
  );
}

/**
 * Factor breakdown for the holdings drill-down, one line per factor:
 * label · rank · value pill, with the pills aligned in a single right-hand
 * column. The 200GO line puts the price-vs-average comparison where the
 * ranks sit and the above/below state in the pill column. Phones get the
 * short "8/17" rank form so the three columns still fit. No weights here —
 * those belong to the Momentum section where they are adjustable.
 */
export function MomentumFactorRows({
  row,
  className = "",
}: {
  row: ScoredItem;
  className?: string;
}) {
  const valueCls = (v: number) =>
    v >= 0
      ? "text-brand-green dark:text-emerald-400"
      : "text-brand-red dark:text-red-400";
  const LABEL = "text-[11px] text-black/45 dark:text-white/50";
  const RANK = "num text-[11px] text-black/55 dark:text-white/60";

  return (
    <div
      className={`grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1.5 ${className}`}
    >
      {FACTORS.map((f) => {
        const value = row[f.key];
        const rank = row.ranks[f.key];
        const n = row.counts[f.key] ?? 0;
        const hasRank = value != null && rank != null;
        return (
          <Fragment key={f.key}>
            <span className={LABEL}>{f.full}:</span>
            <span className={`${RANK} text-right`}>
              {hasRank ? (
                <>
                  <span className="sm:hidden">
                    {rank}/{n}
                  </span>
                  <span className="hidden sm:inline">
                    {n} pozisiyadan {azOrdinal(rank)}
                  </span>
                </>
              ) : (
                "məlumat yoxdur"
              )}
            </span>
            <ValuePill tone={value == null ? "muted" : value >= 0 ? "up" : "down"}>
              {value == null ? "—" : fmtPct(value)}
            </ValuePill>
          </Fragment>
        );
      })}

      <span className={LABEL}>200 günlük ortalama:</span>
      {row.avg200Usd == null ? (
        <>
          <span className={`${RANK} text-right`}>məlumat yoxdur</span>
          <ValuePill tone="muted">—</ValuePill>
        </>
      ) : (
        <>
          <span
            className={`num text-right text-[11px] font-medium ${valueCls(
              row.above200 ? 1 : -1,
            )}`}
          >
            {formatUsd(row.priceUsd)} {row.above200 ? ">" : "<"}{" "}
            {formatUsd(row.avg200Usd)}
          </span>
          <ValuePill tone={row.above200 ? "up" : "down"}>
            {row.above200 ? "üzərində" : "altında"}
          </ValuePill>
        </>
      )}
    </div>
  );
}

