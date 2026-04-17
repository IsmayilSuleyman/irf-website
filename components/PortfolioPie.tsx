"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatAzn } from "@/lib/portfolio";

type Slice = { name: string; value: number; fill: string };

export function PortfolioPie({
  sectors,
  stocks,
}: {
  sectors: Slice[];
  stocks: Slice[];
}) {
  if (!stocks || stocks.length === 0) {
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
            data={sectors}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius="0%"
            outerRadius="58%"
            stroke="#ffffff"
            strokeWidth={1.5}
            isAnimationActive={false}
          >
            {sectors.map((s) => (
              <Cell key={`sector-${s.name}`} fill={s.fill} />
            ))}
          </Pie>
          <Pie
            data={stocks}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius="62%"
            outerRadius="92%"
            stroke="#ffffff"
            strokeWidth={1.5}
            paddingAngle={0.5}
            isAnimationActive={false}
          >
            {stocks.map((s) => (
              <Cell key={`stock-${s.name}`} fill={s.fill} />
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
