"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatAzn, formatGroupedTrim } from "@/lib/portfolio";
import { Masked } from "@/components/Masked";
import { EXTENDED_META } from "@/components/extendedHoursMeta";
import type {
  ExtendedHistoryPoint,
  ExtendedPortfolio,
} from "@/lib/extendedPortfolio";

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
const LINE_COLOR: Record<"pre" | "post", string> = {
  pre: "#f59e0b",
  post: "#a855f7",
};

// Baku is fixed UTC+4 (no DST) — manual math keeps SSR/client output
// identical (no Intl, per the repo's hydration rule).
function bakuHm(iso: string): string {
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return iso;
  const d = new Date(ms + 4 * 60 * 60 * 1000);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

const pctLabel = (v: number) =>
  `${v >= 0 ? "+" : "−"}${formatGroupedTrim(Math.abs(v), 2)}%`;

function HistoryChart({ points }: { points: ExtendedHistoryPoint[] }) {
  const data = points.map((p) => ({
    label: bakuHm(p.t),
    pct: p.changePct * 100,
  }));
  const color = LINE_COLOR[points[points.length - 1]?.mode ?? "post"];
  const crossesZero =
    Math.min(...data.map((d) => d.pct)) < 0 && Math.max(...data.map((d) => d.pct)) > 0;

  return (
    <div className="h-32">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="extHistGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.2} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="rgba(0,0,0,0.45)"
            tick={{ fontSize: 9 }}
            tickLine={false}
            axisLine={false}
            minTickGap={28}
          />
          <YAxis
            width={40}
            domain={["auto", "auto"]}
            tick={{ fontSize: 9, fill: "rgba(0,0,0,0.4)" }}
            tickLine={false}
            axisLine={false}
            tickCount={3}
            tickFormatter={(v: number) => `${formatGroupedTrim(v, 2)}%`}
          />
          <Tooltip
            contentStyle={{
              background: "rgba(255,255,255,0.96)",
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 10,
              boxShadow: "0 8px 30px -12px rgba(0,0,0,0.2)",
              fontSize: 11,
              color: "#0a0a0a",
              padding: "6px 10px",
            }}
            labelStyle={{ color: "rgba(0,0,0,0.55)" }}
            formatter={(v: number) => [pctLabel(v), "Dəyişim"]}
          />
          {crossesZero && (
            <ReferenceLine y={0} stroke="rgba(0,0,0,0.25)" strokeDasharray="4 4" />
          )}
          <Area
            type="monotone"
            dataKey="pct"
            stroke={color}
            strokeWidth={2}
            fill="url(#extHistGrad)"
            dot={{ r: 2, fill: color, strokeWidth: 0 }}
            activeDot={{ r: 4, stroke: "#fff", strokeWidth: 1.5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ExtendedHoursBadge({
  data,
  scope,
  history = [],
}: {
  data: ExtendedPortfolio;
  scope: "fund" | "personal";
  history?: ExtendedHistoryPoint[];
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
              <HistoryChart points={history} />
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
