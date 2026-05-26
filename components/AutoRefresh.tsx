"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { revalidateSheetData } from "@/app/dashboard/refresh-actions";
import { isUsMarketOpen } from "@/lib/marketHours";

// Cadence chosen against the Google Sheets API quota (60 reads/minute/user).
// One full refresh = one batchGet against the snapshot cache = one read, so:
//   - Market open:   3 reads/min/tab (well under quota even with many viewers)
//   - Market closed: 0.5 reads/min/tab (still catches admin edits between sessions)
// Hidden tabs don't tick at all.
const INTERVAL_OPEN_MS = 20_000;
const INTERVAL_CLOSED_MS = 120_000;

function currentIntervalMs(): number {
  return isUsMarketOpen() ? INTERVAL_OPEN_MS : INTERVAL_CLOSED_MS;
}

export function AutoRefresh() {
  const router = useRouter();
  const inFlightRef = useRef(false);
  const lastRunRef = useRef(0);

  useEffect(() => {
    let timeoutId: number | undefined;
    let cancelled = false;

    async function tick() {
      if (inFlightRef.current) return;
      if (document.visibilityState !== "visible") return;
      inFlightRef.current = true;
      try {
        await revalidateSheetData();
        router.refresh();
        lastRunRef.current = Date.now();
      } finally {
        inFlightRef.current = false;
      }
    }

    function scheduleNext() {
      if (cancelled) return;
      timeoutId = window.setTimeout(async () => {
        await tick();
        scheduleNext();
      }, currentIntervalMs());
    }

    function onVisible() {
      if (document.visibilityState !== "visible") return;
      // If the tab was hidden long enough to span the current cadence, fire one
      // catch-up tick immediately so a returning user sees fresh data.
      if (Date.now() - lastRunRef.current >= currentIntervalMs()) {
        tick();
      }
    }

    scheduleNext();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  return null;
}
