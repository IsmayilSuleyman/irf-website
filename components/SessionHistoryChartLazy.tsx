"use client";

import dynamic from "next/dynamic";

// The session-history chart only ever renders inside hover/tap popovers
// (ExtendedHoursBadge, MarketCountdown), so its recharts payload loads on
// first open instead of riding in every page's initial bundle. ssr: false —
// popovers start closed, the server never renders one.
export const SessionHistoryChart = dynamic(
  () =>
    import("@/components/SessionHistoryChart").then(
      (mod) => mod.SessionHistoryChart,
    ),
  {
    ssr: false,
    loading: () => <div className="h-32" />,
  },
);
