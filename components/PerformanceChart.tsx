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
import { formatAzn } from "@/lib/portfolio";

type Point = { label: string; value: number; date?: string };

const RANGES = [
  { key: "1m", label: "1 AY", days: 30 },
  { key: "3m", label: "3 AY", days: 90 },
  { key: "6m", label: "6 AY", days: 180 },
  { key: "1y", label: "1 İL", days: 365 },
  { key: "all", label: "BÜTÜN", days: null },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

export function PerformanceChart({ data }: { data: Point[] }) {
  const [range, setRange] = useState<RangeKey>("all");

  const filtered = useMemo(() => {
    if (!data || data.length === 0) return [];
    const days = RANGES.find((r) => r.key === range)?.days ?? null;
    if (days == null) return data;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return data.filter((p) => {
      if (!p.date) return true;
      const t = new Date(p.date).getTime();
      return Number.isFinite(t) && t >= cutoff;
    });
  }, [data, range]);

  if (!data || data.length === 0) {
    return (
      <div className="glass flex h-72 items-center justify-center text-black/40">
        Tarixçə yoxdur.
      </div>
    );
  }

  return (
    <div className="glass w-full p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] uppercase tracking-[0.22em] text-brand-green/80">
            Sahiblik dəyərinin tarixçəsi
          </span>
          <span className="text-[10px] text-black/35 sm:hidden">₼</span>
        </div>
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
                  : "border-[rgba(22,163,74,0.28)] bg-white/60 text-black/55 hover:border-brand-green hover:text-brand-green"
              }`}
            >
              {r.label}
            </button>
          ))}
          <span className="ml-1 hidden text-[10px] text-black/35 sm:inline">₼</span>
        </div>
      </div>
      <div className="h-72">
        {filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-black/40">
            Bu dövr üçün məlumat yoxdur.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={filtered}
              margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#16a34a" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="rgba(0,0,0,0.45)"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />
              <YAxis hide domain={["auto", "auto"]} />
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
                formatter={(v: number) => [formatAzn(v), "Dəyər"]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#16a34a"
                strokeWidth={2.5}
                fill="url(#g)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
