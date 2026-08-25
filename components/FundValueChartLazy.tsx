"use client";

import dynamic from "next/dynamic";

// Same recipe as PerformanceChartLazy: the recharts hydration JS loads as
// its own on-demand chunk instead of riding the dashboard's first-load.
export const FundValueChart = dynamic(
  () => import("@/components/FundValueChart").then((m) => m.FundValueChart),
  { loading: () => <div className="glass h-80 animate-pulse" /> },
);
