"use client";

import dynamic from "next/dynamic";

// Client-side lazy wrapper — see PerformanceChartLazy for why the dynamic()
// lives in a client module. Admin-only panel; its recharts payload loads on
// demand instead of riding in every holder's dashboard bundle.
export const DebtPanel = dynamic(
  () => import("@/components/DebtPanel").then((mod) => mod.DebtPanel),
  { loading: () => <div className="glass h-64 animate-pulse" /> },
);
