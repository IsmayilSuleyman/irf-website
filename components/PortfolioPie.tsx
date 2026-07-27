"use client";

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Sector } from "recharts";
import { formatAzn } from "@/lib/portfolio";
import { SectorIcon } from "@/components/SectorIcon";

// Slices carry a sector name so the center readout can show the sector glyph
// (stock slices pass their holding's sector; sector slices' name is enough).
type Slice = { name: string; value: number; fill: string; sector?: string };

type ActiveRef = { ring: "sectors" | "stocks"; index: number } | null;

// Hovered slice pops outward a touch. recharts calls this in place of the
// default sector shape when activeIndex matches.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const renderActiveShape = (props: any) => (
  <Sector {...props} outerRadius={props.outerRadius + 5} />
);

export function PortfolioPie({
  sectors,
  stocks,
}: {
  sectors: Slice[];
  stocks: Slice[];
}) {
  const [active, setActive] = useState<ActiveRef>(null);

  if (!stocks || stocks.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-black/45 dark:text-white/50">
        Məlumat yoxdur.
      </div>
    );
  }

  const total = sectors.reduce((s, x) => s + x.value, 0);
  const activeSlice = active
    ? ((active.ring === "sectors" ? sectors : stocks)[active.index] ?? null)
    : null;

  const enter =
    (ring: "sectors" | "stocks") => (_: unknown, index: number) =>
      setActive({ ring, index });
  const clear = () => setActive(null);

  // No strokes: the padding gaps show the card behind, so the rings work on
  // both the light and dark glass without a hard white outline.
  return (
    <div className="relative h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart onMouseLeave={clear}>
          <Pie
            data={sectors}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius="47%"
            outerRadius="62%"
            cornerRadius={5}
            paddingAngle={1.5}
            stroke="none"
            isAnimationActive={false}
            activeIndex={active?.ring === "sectors" ? active.index : undefined}
            activeShape={renderActiveShape}
            onMouseEnter={enter("sectors")}
            onClick={enter("sectors")}
            onMouseLeave={clear}
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
            innerRadius="67%"
            outerRadius="92%"
            cornerRadius={5}
            paddingAngle={1}
            stroke="none"
            isAnimationActive={false}
            activeIndex={active?.ring === "stocks" ? active.index : undefined}
            activeShape={renderActiveShape}
            onMouseEnter={enter("stocks")}
            onClick={enter("stocks")}
            onMouseLeave={clear}
          >
            {stocks.map((s) => (
              <Cell key={`stock-${s.name}`} fill={s.fill} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      {/* Center readout instead of a floating tooltip: exact figures for the
          hovered/tapped slice, the portfolio total at rest. pointer-events
          stay on the slices underneath. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-center">
        {activeSlice ? (
          <>
            <span
              aria-hidden
              className="flex h-6 w-6 items-center justify-center rounded-full"
              style={{
                backgroundColor: `${activeSlice.fill}26`,
                color: activeSlice.fill,
              }}
            >
              <SectorIcon
                sector={activeSlice.sector ?? activeSlice.name}
                className="h-3.5 w-3.5"
              />
            </span>
            <span className="max-w-[7.5rem] truncate text-[11px] text-black/60 dark:text-white/65">
              {activeSlice.name}
            </span>
            <span className="num text-sm font-semibold text-black/85 dark:text-white/90">
              {formatAzn(activeSlice.value)}
            </span>
            {total > 0 && (
              <span className="num text-[10px] text-black/45 dark:text-white/50">
                {((activeSlice.value / total) * 100).toFixed(1)}%
              </span>
            )}
          </>
        ) : (
          <>
            <span className="text-[9px] uppercase tracking-[0.22em] text-black/45 dark:text-white/50">
              Ümumi
            </span>
            <span className="num text-base font-semibold text-black/85 dark:text-white/90">
              {formatAzn(total)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
