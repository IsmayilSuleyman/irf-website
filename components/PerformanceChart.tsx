"use client";

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

type Point = { label: string; value: number };

export function PerformanceChart({ data }: { data: Point[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="glass flex h-72 items-center justify-center text-black/40">
        Tarixçə yoxdur.
      </div>
    );
  }

  return (
    <div className="glass w-full p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <div className="text-[10px] uppercase tracking-[0.22em] text-brand-green/80">
          Sahiblik dəyərinin tarixçəsi
        </div>
        <div className="text-[10px] text-black/35">₼</div>
      </div>
      <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#16a34a" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="rgba(0,0,0,0.06)"
            vertical={false}
          />
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
      </div>
    </div>
  );
}
