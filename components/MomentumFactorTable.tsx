"use client";

import {
  type FactorKey,
  type MomentumWeights,
  type ScoredItem,
} from "@/lib/momentum";
import { formatUsd } from "@/lib/portfolio";

// The per-ticker factor breakdown shared by the Momentum board's expanded
// rows and the Fond Portfeli holdings drill-down: exact factor values,
// rank among the universe, and each factor's (normalized) weight.

export const FACTORS: {
  key: FactorKey;
  short: string;
  full: string;
  weightKey: keyof MomentumWeights;
}[] = [
  { key: "ret4w", short: "4H", full: "4 həftəlik gəlir", weightKey: "w4" },
  { key: "ret13w", short: "13H", full: "13 həftəlik gəlir", weightKey: "w13" },
  { key: "retYtd", short: "YTD", full: "İlin əvvəlindən", weightKey: "wYtd" },
  { key: "rs", short: "RS", full: "SPY-a nisbi güc (13H)", weightKey: "wRs" },
];

export const fmtPct = (v: number) =>
  `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;

/** Green ≥66, amber ≥33, red below — shared by every score rendering. */
export function scoreTone(score: number): { text: string; bar: string } {
  if (score >= 66)
    return {
      text: "text-brand-green dark:text-emerald-400",
      bar: "bg-brand-green",
    };
  if (score >= 33)
    return { text: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500" };
  return { text: "text-brand-red dark:text-red-400", bar: "bg-brand-red" };
}

/** Pill classes (tinted bg + text) for a score chip, same tone bands. */
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

/**
 * Horizontal card layout of the factor breakdown for the holdings
 * drill-down: big colored value, factor name beneath, and the rank spelled
 * out ("17 pozisiyadan 15-ci yer"). The 200GO card compares the price with
 * the average and closes with an above/below pill. No weights here — those
 * belong to the Momentum section where they are adjustable.
 */
export function MomentumFactorCards({
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
  const MUTED = "text-black/30 dark:text-white/35";
  return (
    <div
      className={`grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5 ${className}`}
    >
      {FACTORS.map((f) => {
        const value = row[f.key];
        const rank = row.ranks[f.key];
        const n = row.counts[f.key] ?? 0;
        return (
          <div
            key={f.key}
            className="flex flex-col items-center gap-0.5 text-center"
          >
            <span
              className={`num text-xl font-semibold ${
                value == null ? MUTED : valueCls(value)
              }`}
            >
              {value == null ? "—" : fmtPct(value)}
            </span>
            <span className="text-[11px] text-black/45 dark:text-white/50">
              {f.full}
            </span>
            <span className="num text-[11px] text-black/55 dark:text-white/60">
              {value == null || rank == null
                ? "məlumat yoxdur"
                : `${n} pozisiyadan ${azOrdinal(rank)} yer`}
            </span>
          </div>
        );
      })}
      <div className="flex flex-col items-center gap-0.5 text-center">
        {row.avg200Usd == null ? (
          <>
            <span className={`num text-xl font-semibold ${MUTED}`}>—</span>
            <span className="text-[11px] text-black/45 dark:text-white/50">
              200 günlük ortalama
            </span>
            <span className="text-[11px] text-black/55 dark:text-white/60">
              məlumat yoxdur
            </span>
          </>
        ) : (
          <>
            <span
              className={`num pt-1.5 text-sm font-semibold ${valueCls(
                row.above200 ? 1 : -1,
              )}`}
            >
              {formatUsd(row.priceUsd)} {row.above200 ? ">" : "<"}{" "}
              {formatUsd(row.avg200Usd)}
            </span>
            <span className="text-[11px] text-black/45 dark:text-white/50">
              200 günlük ortalamanın
            </span>
            <span
              className={`rounded-full border px-1.5 py-px text-[10px] font-medium ${
                row.above200
                  ? "border-brand-green/40 text-brand-green dark:text-emerald-400"
                  : "border-brand-red/40 text-brand-red dark:text-red-400"
              }`}
            >
              {row.above200 ? "üzərindədir" : "altındadır"}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export function MomentumFactorTable({
  row,
  weights,
  className = "",
}: {
  row: ScoredItem;
  weights: MomentumWeights;
  className?: string;
}) {
  const totalW =
    FACTORS.reduce((s, f) => s + Math.max(0, weights[f.weightKey]), 0) +
    Math.max(0, weights.wTrend);
  const wPct = (w: number) =>
    totalW > 0 ? `${Math.round((Math.max(0, w) / totalW) * 100)}%` : "—";
  return (
    <div className={`flex flex-col gap-1 text-[11px] ${className}`}>
      {FACTORS.map((f) => {
        const value = row[f.key];
        const rank = row.ranks[f.key];
        const n = row.counts[f.key] ?? 0;
        return (
          <div key={f.key} className="flex items-baseline gap-2">
            <span className="w-32 shrink-0 text-black/55 dark:text-white/60">
              <span className="font-medium">{f.short}</span>
              <span className="ml-1 text-[10px] text-black/40 dark:text-white/40">
                {f.full}
              </span>
            </span>
            {value == null ? (
              <span className="num text-black/40 dark:text-white/45">
                məlumat yoxdur
              </span>
            ) : (
              <>
                <span
                  className={`num w-16 text-right font-medium ${
                    value >= 0
                      ? "text-brand-green dark:text-emerald-400"
                      : "text-brand-red dark:text-red-400"
                  }`}
                >
                  {fmtPct(value)}
                </span>
                <span className="num text-black/45 dark:text-white/50">
                  #{rank}/{n}
                </span>
              </>
            )}
            <span className="num ml-auto text-black/40 dark:text-white/45">
              çəki {wPct(weights[f.weightKey])}
            </span>
          </div>
        );
      })}
      <div className="flex items-baseline gap-2">
        <span className="w-32 shrink-0 text-black/55 dark:text-white/60">
          <span className="font-medium">200GO</span>
          <span className="ml-1 text-[10px] text-black/40 dark:text-white/40">
            200 günlük ortalama
          </span>
        </span>
        {row.avg200Usd == null ? (
          <span className="num text-black/40 dark:text-white/45">
            məlumat yoxdur
          </span>
        ) : (
          <span
            className={`num font-medium ${
              row.above200
                ? "text-brand-green dark:text-emerald-400"
                : "text-brand-red dark:text-red-400"
            }`}
          >
            {formatUsd(row.priceUsd)} {row.above200 ? ">" : "<"}{" "}
            {formatUsd(row.avg200Usd)} {row.above200 ? "✓" : "✗"}
          </span>
        )}
        <span className="num ml-auto text-black/40 dark:text-white/45">
          çəki {wPct(weights.wTrend)}
        </span>
      </div>
    </div>
  );
}
