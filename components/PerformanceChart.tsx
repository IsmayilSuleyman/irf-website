"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatAzn, formatGrouped } from "@/lib/portfolio";
import { usePrivacy } from "@/components/PrivacyProvider";

type Point = { label: string; value: number; date?: string };

// Hydration-safe Azerbaijani date labels (no Intl in a client component).
const AZ_MONTHS_SHORT = [
  "yan", "fev", "mar", "apr", "may", "iyn",
  "iyl", "avq", "sen", "okt", "noy", "dek",
];
const AZ_MONTHS_LONG = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr",
];

function tickDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCDate()} ${AZ_MONTHS_SHORT[d.getUTCMonth()]} ${String(d.getUTCFullYear() % 100).padStart(2, "0")}`;
}

function tooltipDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCDate()} ${AZ_MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const RANGES = [
  { key: "1m", label: "1 AY", days: 30 },
  { key: "3m", label: "3 AY", days: 90 },
  { key: "6m", label: "6 AY", days: 180 },
  { key: "1y", label: "1 İL", days: 365 },
  { key: "all", label: "BÜTÜN", days: null },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

const MODES = [
  { key: "value", label: "SAHİBLİK DƏYƏRİ" },
  { key: "price", label: "PAY QİYMƏTİ" },
] as const;

type ModeKey = (typeof MODES)[number]["key"];

export function PerformanceChart({
  data,
  priceData,
}: {
  data: Point[];
  priceData?: Point[];
}) {
  const { hidden } = usePrivacy();
  const hasValue = data != null && data.length > 0;
  const hasPrice = priceData != null && priceData.length > 0;
  // New holders with no transactions still get the public price series.
  const [mode, setMode] = useState<ModeKey>(hasValue ? "value" : "price");
  const [range, setRange] = useState<RangeKey>("all");

  const source = mode === "price" ? (priceData ?? []) : data;

  const filtered = useMemo(() => {
    if (!source || source.length === 0) return [];
    const days = RANGES.find((r) => r.key === range)?.days ?? null;
    if (days == null) return source;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return source.filter((p) => {
      if (!p.date) return true;
      const t = new Date(p.date).getTime();
      return Number.isFinite(t) && t >= cutoff;
    });
  }, [source, range]);

  // Numeric (epoch-ms) x-axis: points sit at their true time distance, so
  // sparse early history doesn't get compressed into equal category slots.
  // Points without a parseable date (none in practice) are dropped.
  const timed = useMemo(
    () =>
      filtered
        .map((p) => ({ ...p, ts: p.date ? new Date(p.date).getTime() : NaN }))
        .filter((p) => Number.isFinite(p.ts))
        .sort((a, b) => a.ts - b.ts),
    [filtered],
  );

  const last = timed.length > 0 ? timed[timed.length - 1] : null;

  if (!hasValue && !hasPrice) {
    return (
      <div className="glass flex h-72 items-center justify-center text-black/45 dark:text-white/50">
        Tarixçə yoxdur.
      </div>
    );
  }

  // Your holding value is personal — masked in hide-amounts mode. The unit
  // price is the same for every holder (public), so it never gets masked.
  const masked = hidden && mode === "value";

  return (
    <div className="glass w-full p-6">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] uppercase tracking-[0.22em] text-brand-green/80">
            {mode === "price"
              ? "1 payın qiymətinin tarixçəsi"
              : "Sahiblik dəyərinin tarixçəsi"}
          </span>
          <span className="text-[10px] text-black/45 dark:text-white/50 sm:hidden">₼</span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
          {/* Series switch — same button language as the range buttons so it
              reads as a control, not a label. */}
          {hasValue && hasPrice && (
            <div className="grid grid-cols-2 gap-1 sm:flex sm:items-center">
              {MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMode(m.key)}
                  aria-pressed={mode === m.key}
                  className={`rounded-lg border px-1.5 py-1.5 text-center text-[10px] font-medium tracking-[0.06em] transition sm:px-3 sm:py-1 sm:text-[11px] sm:tracking-[0.08em] ${
                    mode === m.key
                      ? "border-brand-green bg-brand-green text-white shadow-sm"
                      : "border-brand-green/30 bg-white/60 dark:bg-white/5 text-black/55 dark:text-white/60 hover:border-brand-green hover:text-brand-green dark:hover:text-emerald-400"
                  }`}
                >
                  {m.label}
                </button>
              ))}
              <span
                aria-hidden
                className="mx-1 hidden h-4 w-px bg-black/10 dark:bg-white/15 sm:inline-block"
              />
            </div>
          )}
          <div className="grid grid-cols-5 gap-1 sm:flex sm:items-center">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRange(r.key)}
                aria-pressed={range === r.key}
                className={`rounded-lg border px-1.5 py-1.5 text-center text-[10px] font-medium tracking-[0.06em] transition sm:px-3 sm:py-1 sm:text-[11px] sm:tracking-[0.08em] ${
                  range === r.key
                    ? "border-brand-green bg-brand-green text-white shadow-sm"
                    : "border-brand-green/30 bg-white/60 dark:bg-white/5 text-black/55 dark:text-white/60 hover:border-brand-green hover:text-brand-green dark:hover:text-emerald-400"
                }`}
              >
                {r.label}
              </button>
            ))}
            <span className="ml-1 hidden text-[10px] text-black/45 dark:text-white/50 sm:inline">₼</span>
          </div>
        </div>
      </div>
      <div className="h-72">
        {timed.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-black/45 dark:text-white/50">
            Bu dövr üçün məlumat yoxdur.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={timed}
              margin={{ top: 10, right: 14, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#16a34a" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
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
                minTickGap={24}
                tickFormatter={tickDate}
              />
              <YAxis
                hide={masked}
                domain={["auto", "auto"]}
                width={52}
                tick={{ fontSize: 10, fill: "rgba(0,0,0,0.4)" }}
                tickLine={false}
                axisLine={false}
                tickCount={4}
                tickFormatter={(v: number) => formatGrouped(v, 0)}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(255,255,255,0.96)",
                  border: "1px solid rgba(0,0,0,0.08)",
                  borderRadius: 12,
                  boxShadow: "0 8px 30px -12px rgba(0,0,0,0.2)",
                  fontSize: 12,
                  color: "#0a0a0a",
                }}
                labelStyle={{ color: "rgba(0,0,0,0.55)" }}
                labelFormatter={(ms: number) => tooltipDate(ms)}
                formatter={(v: number) => [
                  masked ? "••••" : formatAzn(v),
                  mode === "price" ? "1 payın qiyməti" : "Dəyər",
                ]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#16a34a"
                strokeWidth={2.5}
                fill="url(#g)"
              />
              {last && (
                <ReferenceDot
                  x={last.ts}
                  y={last.value}
                  r={4}
                  fill="#16a34a"
                  stroke="#fff"
                  strokeWidth={2}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
