"use client";

import dynamic from "next/dynamic";

// Client-side lazy wrapper: next/dynamic only code-splits client components
// when called from a client module, so this file (not the server page) owns
// the split. The card still server-renders in full on hard loads; only its
// recharts hydration JS loads as a separate chunk. The fallback flashes just
// during client-side navigations, holding the card's height.
export const PerformanceChart = dynamic(
  () =>
    import("@/components/PerformanceChart").then((mod) => mod.PerformanceChart),
  { loading: () => <div className="glass h-[520px] animate-pulse" /> },
);
