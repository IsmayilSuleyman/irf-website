"use client";

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
import { formatGroupedTrim } from "@/lib/portfolio";
import type { SessionHistoryPoint } from "@/lib/sessionHistory";

// Baku is fixed UTC+4 (no DST) — manual math keeps SSR/client output
// identical (no Intl, per the repo's hydration rule).
function bakuParts(iso: string): { day: string; hm: string } {
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return { day: "", hm: iso };
  const d = new Date(ms + 4 * 60 * 60 * 1000);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return { day: `${dd}.${mo}`, hm: `${hh}:${mm}` };
}

const pctLabel = (v: number) =>
  `${v >= 0 ? "+" : "−"}${formatGroupedTrim(Math.abs(v), 2)}%`;

/**
 * Mini %-movement chart for the session-history popovers (one point per
 * 10-minute snapshot). labelKind "time" shows HH:MM (single session);
 * "datetime" shows dd.MM HH:MM (weekly view spanning several days).
 */
export function SessionHistoryChart({
  points,
  color,
  labelKind = "time",
}: {
  points: SessionHistoryPoint[];
  color: string;
  labelKind?: "time" | "datetime";
}) {
  // Numeric (epoch-ms) x-axis: points sit at their true time distance, so a
  // recording gap shows as real horizontal space, not one category slot.
  const data = points
    .map((p) => ({ ts: new Date(p.t).getTime(), pct: p.changePct * 100 }))
    .filter((d) => Number.isFinite(d.ts))
    .sort((a, b) => a.ts - b.ts);
  const values = data.map((d) => d.pct);
  const crossesZero = Math.min(...values) < 0 && Math.max(...values) > 0;

  const tickLabel = (ms: number) => {
    const parts = bakuParts(new Date(ms).toISOString());
    return labelKind === "datetime" ? `${parts.day} ${parts.hm}` : parts.hm;
  };

  return (
    <div className="h-32">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="sessHistGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.2} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
          <XAxis
            dataKey="ts"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            stroke="rgba(0,0,0,0.45)"
            tick={{ fontSize: 9 }}
            tickLine={false}
            axisLine={false}
            minTickGap={32}
            tickFormatter={tickLabel}
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
            labelFormatter={(ms: number) => tickLabel(ms)}
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
            fill="url(#sessHistGrad)"
            dot={{ r: 2, fill: color, strokeWidth: 0 }}
            activeDot={{ r: 4, stroke: "#fff", strokeWidth: 1.5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
