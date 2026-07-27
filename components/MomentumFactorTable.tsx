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
