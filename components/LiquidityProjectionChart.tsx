"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatAzn, formatGrouped } from "@/lib/portfolio";
import type { LiquidityProjectionPoint } from "@/lib/liquidityProjection";

const BANK_BLUE = "#2f61d8";
const LATE_RED = "#e11d48";

// "2026-10-14" -> "14 okt" — pure string math, no Intl (hydration-safe).
const AZ_MONTHS_SHORT = [
  "yan", "fev", "mar", "apr", "may", "iyn",
  "iyl", "avq", "sen", "okt", "noy", "dek",
];
function shortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} ${AZ_MONTHS_SHORT[Number(m[2]) - 1] ?? m[2]}`;
}

type ChartPoint = LiquidityProjectionPoint & { label: string };

function EventTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0].payload;
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.96)",
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 12,
        boxShadow: "0 8px 30px -12px rgba(0,0,0,0.2)",
        fontSize: 12,
        color: "#0a0a0a",
        padding: "10px 12px",
        maxWidth: 260,
      }}
    >
      <div style={{ opacity: 0.55 }}>{shortDate(p.date)}</div>
      <div className="num" style={{ fontWeight: 700, marginTop: 2 }}>
        {formatAzn(p.valueAzn)}
      </div>
      {p.events.length > 0 && (
        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 2 }}>
          {p.events.map((e, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span style={{ opacity: 0.7 }}>{e.label}</span>
              <span
                className="num"
                style={{
                  fontWeight: 600,
                  color: e.amountAzn >= 0 ? "#15803d" : LATE_RED,
                }}
              >
                {e.amountAzn >= 0 ? "+" : "−"}
                {formatAzn(Math.abs(e.amountAzn))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Step line of the bank's projected net liquidity: every known scheduled
 * cash event (loan repayments in; deposit maturities, bond coupons and
 * redemptions out) as a cumulative walk from today's value.
 */
export function LiquidityProjectionChart({
  points,
}: {
  points: LiquidityProjectionPoint[];
}) {
  if (points.length < 2) return null;

  const data: ChartPoint[] = points.map((p) => ({ ...p, label: shortDate(p.date) }));
  const last = data[data.length - 1];
  const min = Math.min(...data.map((p) => p.valueAzn));
  const dipsNegative = min < 0;

  return (
    <div className="h-64 sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 14, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="liqGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BANK_BLUE} stopOpacity={0.2} />
              <stop offset="100%" stopColor={BANK_BLUE} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="rgba(0,0,0,0.45)"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            minTickGap={28}
          />
          <YAxis
            domain={[dipsNegative ? "auto" : 0, "auto"]}
            width={56}
            tick={{ fontSize: 10, fill: "rgba(0,0,0,0.4)" }}
            tickLine={false}
            axisLine={false}
            tickCount={4}
            tickFormatter={(v: number) => formatGrouped(v, 0)}
          />
          <Tooltip content={<EventTooltip />} />
          {dipsNegative && (
            <ReferenceLine y={0} stroke={LATE_RED} strokeDasharray="4 4" strokeOpacity={0.6} />
          )}
          <Area
            type="stepAfter"
            dataKey="valueAzn"
            stroke={BANK_BLUE}
            strokeWidth={2.5}
            fill="url(#liqGrad)"
            dot={{ r: 3, fill: BANK_BLUE, strokeWidth: 0 }}
            activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }}
          />
          <ReferenceDot
            x={last.label}
            y={last.valueAzn}
            r={4}
            fill={BANK_BLUE}
            stroke="#fff"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
