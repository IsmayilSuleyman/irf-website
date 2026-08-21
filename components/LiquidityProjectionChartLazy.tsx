"use client";

import dynamic from "next/dynamic";

// Client-side lazy wrapper — see PerformanceChartLazy for why the dynamic()
// lives in a client module. Keeps recharts out of /bank's first load.
export const LiquidityProjectionChart = dynamic(
  () =>
    import("@/components/LiquidityProjectionChart").then(
      (mod) => mod.LiquidityProjectionChart,
    ),
  { loading: () => <div className="h-64 sm:h-72" /> },
);
