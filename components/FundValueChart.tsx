"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { usePrivacy } from "@/components/PrivacyProvider";
import { formatAzn, formatGrouped } from "@/lib/portfolio";

// The fund view's own value chart — the "Ümumfond dəyər tarixçəsi comes
// later" promise, delivered from the minutely snapshots: fondun ümumi
// dəyəri over the last day / week / month. The series records the LIVE
// figures (session deltas folded in), so this line is exactly what the
// hero above showed at every minute.

export type FundChartPoint = { label: string; value: number; date: string };

const GREEN = "#16a34a";

const RANGES = [
  { key: "day", label: "1G" },
  { key: "week", label: "1H" },
  { key: "month", label: "1 AY" },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

// Hydration-safe Azerbaijani labels (no Intl in a client component);
// Baku is fixed UTC+4.
const AZ_MONTHS_SHORT = [
  "yan", "fev", "mar", "apr", "may", "iyn",
  "iyl", "avq", "sen", "okt", "noy", "dek",
];

function bakuTime(ms: number): string {
  const d = new Date(ms + 4 * 3_600_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

function bakuDate(ms: number): string {
  const d = new Date(ms + 4 * 3_600_000);
  return `${d.getUTCDate()} ${AZ_MONTHS_SHORT[d.getUTCMonth()]}`;
}

export function FundValueChart({
  tiers,
}: {
  tiers: { day: FundChartPoint[]; week: FundChartPoint[]; month: FundChartPoint[] };
}) {
  const { hidden } = usePrivacy();
  const [range, setRange] = useState<RangeKey>("day");

  // A tier can be thinner than its window while the recorder is young —
  // show whatever exists; a tier under 2 points falls back to the widest
  // one that has data.
  const activeRange: RangeKey =
    tiers[range].length >= 2
      ? range
      : tiers.day.length >= 2
        ? "day"
        : tiers.week.length >= 2
          ? "week"
          : "month";

  const timed = useMemo(
    () =>
      tiers[activeRange]
        .map((p) => ({ ...p, ts: new Date(p.date).getTime() }))
        .filter((p) => Number.isFinite(p.ts))
        .sort((a, b) => a.ts - b.ts),
    [tiers, activeRange],
  );

  const spanMs = timed.length > 1 ? timed[timed.length - 1].ts - timed[0].ts : 0;
  const timeTicks = spanMs > 0 && spanMs <= 50 * 3_600_000;

  const periodPct = useMemo(() => {
    if (timed.length < 2) return null;
    const open = timed[0].value;
    return open > 0 ? timed[timed.length - 1].value / open - 1 : null;
  }, [timed]);

  const fmt = (v: number) => (hidden ? "••••" : formatAzn(v));

  if (timed.length < 2) {
    return (
      <div className="glass flex flex-col gap-2 p-6">
        <div className="text-[11px] uppercase tracking-[0.16em] text-brand-green/80 sm:text-[14px] sm:tracking-[0.22em]">
          Fondun dəyər tarixçəsi
        </div>
        <p className="py-8 text-center text-sm text-black/45 dark:text-white/50">
          Qeydlər hər dəqiqə avtomatik toplanır — ilk qrafik bir neçə
          saatdan sonra burada görünəcək.
        </p>
      </div>
    );
  }

  return (
    <div className="glass flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[11px] uppercase tracking-[0.16em] text-brand-green/80 sm:text-[14px] sm:tracking-[0.22em]">
          Fondun dəyər tarixçəsi
        </div>
        <div className="flex items-center gap-2">
          {periodPct != null ? (
            <span
              className={`num rounded-lg border px-2 py-1 text-[10px] font-semibold tracking-[0.06em] sm:px-3 sm:text-[11px] ${
                periodPct >= 0
                  ? "border-brand-green/30 bg-brand-green/10 text-brand-green dark:text-emerald-400"
                  : "border-brand-red/30 bg-brand-red/10 text-brand-red dark:text-red-400"
              }`}
            >
              {periodPct >= 0 ? "+" : ""}
              {(periodPct * 100).toFixed(2)}%
            </span>
          ) : null}
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              aria-pressed={activeRange === r.key}
              className={`rounded-lg border px-2 py-1 text-[10px] font-medium tracking-[0.06em] transition sm:px-3 sm:text-[11px] ${
                activeRange === r.key
                  ? "border-brand-green bg-brand-green text-white shadow-sm"
                  : "border-brand-green/30 bg-white/60 dark:bg-white/5 text-black/55 dark:text-white/60 hover:border-brand-green hover:text-brand-green dark:hover:text-emerald-400"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-56 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={timed} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient id="fundValueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={GREEN} stopOpacity={0.24} />
                <stop offset="100%" stopColor={GREEN} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
            <XAxis
              dataKey="ts"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              stroke="rgba(0,0,0,0.45)"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              minTickGap={32}
              tickFormatter={timeTicks ? bakuTime : bakuDate}
            />
            <YAxis
              hide={hidden}
              orientation="right"
              mirror
              domain={["auto", "auto"]}
              width={1}
              tick={{ fontSize: 10, fill: "rgba(0,0,0,0.4)" }}
              tickLine={false}
              axisLine={false}
              tickCount={4}
              tickFormatter={(v: number) => formatGrouped(v, 0)}
            />
            <Tooltip
              content={({ active, payload }) => {
                const p =
                  active && payload && payload.length > 0
                    ? (payload[0].payload as FundChartPoint & { ts: number })
                    : null;
                if (!p) return null;
                return (
                  <div
                    className="rounded-xl px-3.5 py-2.5 text-[12px]"
                    style={{
                      background: "rgba(255,255,255,0.96)",
                      border: "1px solid rgba(0,0,0,0.08)",
                      boxShadow: "0 8px 30px -12px rgba(0,0,0,0.3)",
                    }}
                  >
                    <p className="text-[11px] text-black/50 dark:text-white/55">
                      {bakuDate(p.ts)}, {bakuTime(p.ts)}
                    </p>
                    <p className="num mt-1 font-semibold text-black dark:text-white/90">
                      {fmt(p.value)}
                    </p>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={GREEN}
              strokeWidth={2.5}
              fill="url(#fundValueFill)"
              activeDot={{ r: 4, stroke: "#fff", strokeWidth: 1.5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[10px] text-black/40 dark:text-white/45">
        Hər dəqiqə avtomatik qeyd olunur — seans hərəkətləri daxil olmaqla,
        heroda gördüyün canlı rəqəmin özü.
      </p>
    </div>
  );
}
