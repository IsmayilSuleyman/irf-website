"use client";

import { useState } from "react";
import { formatAzn, formatGroupedTrim } from "@/lib/portfolio";
import { Masked } from "@/components/Masked";
import { EXTENDED_META } from "@/components/extendedHoursMeta";
import { SessionHistoryChart } from "@/components/SessionHistoryChart";
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
}: {
  data: ExtendedPortfolio;
  scope: "fund" | "personal";
  history?: SessionHistoryPoint[];
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
        <span className="text-black/45 dark:text-white/50">{meta.label}:</span>
        <span className={`num font-semibold ${numberTone}`}>{pct}</span>
        {showDelta ? (
          <Masked mask="••••" className="text-black/45 dark:text-white/50">
            <span className={`num opacity-90 ${numberTone}`}>({delta})</span>
          </Masked>
        ) : null}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-80 max-w-[85vw] rounded-xl border border-black/10 dark:border-white/15 bg-white/95 dark:bg-neutral-900/95 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.25)] backdrop-blur-md">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/50">
              {chartTitle}
            </span>
            <span className={`num text-sm font-semibold ${numberTone}`}>{pct}</span>
          </div>
          <p className="mt-0.5 text-[10px] leading-4 text-black/45 dark:text-white/50">
            Portfel {meta.tooltip} · {data.coveredCount}/{data.totalCount} mövqe
            {showDelta ? ` · ${SCOPE_TOOLTIP[scope]}` : ""}
          </p>

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
