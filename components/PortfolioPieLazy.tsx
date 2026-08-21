"use client";

import dynamic from "next/dynamic";

// Client-side lazy wrapper — see PerformanceChartLazy for why the dynamic()
// lives in a client module. Keeps recharts out of the dashboard's first load.
export const PortfolioPie = dynamic(
  () => import("@/components/PortfolioPie").then((mod) => mod.PortfolioPie),
  { loading: () => <div className="h-72" /> },
);
