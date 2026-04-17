"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatAzn } from "@/lib/portfolio";

type Slice = { name: string; value: number };

const PALETTE = [
  "#16a34a",
  "#22c55e",
  "#15803d",
  "#4ade80",
  "#166534",
  "#86efac",
  "#14532d",
  "#bbf7d0",
  "#0f3d1f",
];

export function PortfolioPie({ data }: { data: Slice[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-black/40">
        Məlumat yoxdur.
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="0%"
            outerRadius="92%"
            stroke="#ffffff"
            strokeWidth={2}
            paddingAngle={1}
            isAnimationActive={false}
          >
            {data.map((entry, i) => (
              <Cell
                key={entry.name}
                fill={PALETTE[i % PALETTE.length]}
              />
            ))}
          </Pie>
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
            formatter={(v: number, n) => [formatAzn(v), n as string]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
