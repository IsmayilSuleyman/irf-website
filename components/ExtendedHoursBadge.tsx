"use client";

import { useState } from "react";
import { formatAzn, formatGroupedTrim } from "@/lib/portfolio";
import { Masked } from "@/components/Masked";
import { EXTENDED_META } from "@/components/extendedHoursMeta";
import { SessionHistoryChart } from "@/components/SessionHistoryChartLazy";
import type { SessionHistoryPoint } from "@/lib/sessionHistory";
import type { ExtendedPortfolio } from "@/lib/extendedPortfolio";

/**
 * "Açılışdan əvvəl: +1,03%" chip for the dashboard's market-countdown row,
 * with a hover/tap popover charting the session's recorded movement
 * (one snapshot per 10 minutes, captured by dashboard renders). The pill is
 * neutral (MarketCountdown recipe); only the numbers carry the direction
 * colour. The ₼ delta respects hide-amounts mode live via <Masked>. In the
 * personal view the caller passes a delta already scaled to the viewer's
 * share of the fund.
 */
const SCOPE_TOOLTIP: Record<"fund" | "personal", string> = {
  fund: "fondun ümumi dəyişimi",
  personal: "sizin payınıza düşən məbləğ",
};

const SCOPE_VALUE_LABEL: Record<"fund" | "personal", string> = {
  fund: "Fondun dəyəri",
  personal: "Sərmayənizin dəyəri",
};

// Chart line follows the DATA's session (post data stays purple even when
// hovered from the Gecə badge).
const LINE_COLOR: Record<"pre" | "post" | "regular", string> = {
  pre: "#f59e0b",
  post: "#a855f7",
  regular: "#16a34a",
};

export function ExtendedHoursBadge({
  data,
  scope,
  history = [],
  align = "left",
  extra,
}: {
  data: ExtendedPortfolio;
  scope: "fund" | "personal";
  history?: SessionHistoryPoint[];
  /** Popover anchor edge — "right" when the badge sits near a card's right edge. */
  align?: "left" | "right";
  /**
   * Absolute figures for the popover (phones can't fit them in the pill):
   * the value the delta applies to at the last close (viewer's slice or the
   * whole fund, per scope), and the İRF pay price at close / at extended
   * prices.
   */
  extra?: {
    baseValueAzn: number;
    unitPriceAzn: number;
    unitPriceExtAzn: number | null;
  };
}) {
  const [open, setOpen] = useState(false);
  const up = data.changePct >= 0;
  const meta = EXTENDED_META[data.mode];
  const sign = up ? "+" : "−";
  const pct = `${sign}${formatGroupedTrim(Math.abs(data.changePct) * 100, 2)}%`;
  // A delta that rounds to 0,00 ₼ (e.g. a holder with no units) is noise.
  const showDelta = Math.abs(data.deltaAzn) >= 0.005;
  const delta = `${sign}${formatAzn(Math.abs(data.deltaAzn))}`;
  const numberTone = up
    ? "text-brand-green dark:text-emerald-400"
    : "text-brand-red dark:text-red-400";

  // Overnight shows the last after-market session's curve — say so.
  const chartTitle =
    data.mode === "overnight"
      ? "Son after-market seansının hərəkəti"
      : `${meta.label} — seansın hərəkəti`;
  const lineColor = LINE_COLOR[history[history.length - 1]?.mode ?? "post"];

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/10 px-3 py-1.5 text-[11px] font-medium shadow-sm"
      >
        <span className={`shrink-0 ${meta.iconTint}`}>{meta.icon}</span>
        {/* Phones show icon + percent only, so the badge shares one row with
            the countdown chip; the label and ₼ delta live in the popover
            (and return inline on sm+). */}
        <span className="hidden text-black/45 dark:text-white/50 sm:inline">
          {meta.label}:
        </span>
        <span className={`num font-semibold ${numberTone}`}>{pct}</span>
        {showDelta ? (
          <span className="hidden sm:inline">
            <Masked mask="••••" className="text-black/45 dark:text-white/50">
              <span className={`num opacity-90 ${numberTone}`}>({delta})</span>
            </Masked>
          </span>
        ) : null}
      </button>

      {open && (
        <div
          className={`absolute top-full z-50 mt-2 rounded-xl border border-black/10 dark:border-white/15 bg-white/95 dark:bg-neutral-900/95 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.25)] backdrop-blur-md ${
            // Right-anchored (chart-card placement) stays narrower so the
            // panel can't run off the left edge of a phone screen.
            align === "right"
              ? "right-0 w-72 max-w-[75vw]"
              : "left-0 w-80 max-w-[85vw]"
          }`}
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/50">
              {chartTitle}
            </span>
            {/* Pct + ₼ side by side: phones hide the delta in the pill, so
                the popover is where the manat amount is always readable. */}
            <span className="flex items-baseline gap-1.5 whitespace-nowrap">
              <span className={`num text-sm font-semibold ${numberTone}`}>{pct}</span>
              {showDelta ? (
                <Masked mask="••••" className="text-black/45 dark:text-white/50">
                  <span className={`num text-[11px] font-medium opacity-90 ${numberTone}`}>
                    ({delta})
                  </span>
                </Masked>
              ) : null}
            </span>
          </div>
          <p className="mt-0.5 text-[10px] leading-4 text-black/45 dark:text-white/50">
            Portfel {meta.tooltip} · {data.coveredCount}/{data.totalCount} mövqe
            {showDelta ? ` · ${SCOPE_TOOLTIP[scope]}` : ""}
          </p>

          {extra ? (
            <div className="mt-2.5 space-y-1 rounded-lg border border-black/[0.06] dark:border-white/10 bg-black/[0.03] dark:bg-white/5 px-2.5 py-2 text-[11px]">
              <p className="flex items-center justify-between gap-4">
                <span className="text-black/50 dark:text-white/55">
                  {SCOPE_VALUE_LABEL[scope]}
                </span>
                <Masked mask="••••">
                  <span className="num font-semibold text-black dark:text-white/90">
                    {formatAzn(extra.baseValueAzn + data.deltaAzn)}
                  </span>
                </Masked>
              </p>
              {extra.unitPriceExtAzn != null ? (
                <p className="flex items-center justify-between gap-4">
                  <span className="text-black/50 dark:text-white/55">
                    1 payın qiyməti
                  </span>
                  {/* The pay price is public — never masked. */}
                  <span className="num text-black/60 dark:text-white/65">
                    {formatAzn(extra.unitPriceAzn)}
                    <span className="mx-1 opacity-50">→</span>
                    <span className="font-semibold text-black dark:text-white/90">
                      {formatAzn(extra.unitPriceExtAzn)}
                    </span>
                  </span>
                </p>
              ) : null}
            </div>
          ) : null}

          {history.length >= 2 ? (
            <div className="mt-3">
              <SessionHistoryChart points={history} color={lineColor} />
            </div>
          ) : (
            <div className="mt-3 flex h-20 items-center justify-center text-center text-[11px] leading-4 text-black/45 dark:text-white/50">
              Hələ kifayət qədər qeyd yoxdur — qrafik seans boyu
              <br />
              hər 10 dəqiqədən bir yığılan qeydlərdən qurulur.
            </div>
          )}

          <p className="mt-2 text-[10px] text-black/45 dark:text-white/50">
            Hər 10 dəqiqədən bir qeyd olunur.
          </p>
        </div>
      )}
    </span>
  );
}
