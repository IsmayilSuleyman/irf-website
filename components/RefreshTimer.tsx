"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { revalidateSheetData } from "@/app/dashboard/refresh-actions";
import { isUsMarketOpen } from "@/lib/marketHours";

// Cadence chosen against the Google Sheets API quota (60 reads/minute/user).
// One full refresh = one batchGet against the snapshot cache = one read, so:
//   - Market open:   4 reads/min/tab  (well under quota even with many viewers)
//   - Market closed: 0.5 reads/min/tab (still catches admin edits between sessions)
// Hidden tabs don't tick at all.
const INTERVAL_OPEN_MS = 15_000;
const INTERVAL_CLOSED_MS = 120_000;

export function RefreshTimer() {
  const router = useRouter();
  const [open, setOpen] = useState<boolean | null>(null);
  // 0 = just refreshed, 1 = about to refresh.
  const [progress, setProgress] = useState(0);
  const inFlightRef = useRef(false);

  // Watch the market state so the cadence flips on the open/close boundary.
  useEffect(() => {
    const update = () => setOpen(isUsMarketOpen());
    update();
    const id = window.setInterval(update, 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Refresh loop. Re-mounts (and resets the cycle) whenever the cadence
  // changes, which is what we want — opening/closing should restart the ring.
  useEffect(() => {
    if (open === null) return;
    const interval = open ? INTERVAL_OPEN_MS : INTERVAL_CLOSED_MS;
    let cycleStart = Date.now();

    async function fire() {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      // Reset the cycle the moment we start fetching, so the ring snaps back
      // to full and the next countdown begins immediately. If the fetch takes
      // a beat, the visual is slightly optimistic — fine for our purposes.
      cycleStart = Date.now();
      setProgress(0);
      try {
        await revalidateSheetData();
        router.refresh();
      } finally {
        inFlightRef.current = false;
      }
    }

    const tickId = window.setInterval(() => {
      const elapsed = Date.now() - cycleStart;
      const p = Math.min(1, elapsed / interval);
      setProgress(p);
      if (elapsed >= interval && document.visibilityState === "visible") {
        fire();
      }
    }, 100);

    function onVisible() {
      if (document.visibilityState !== "visible") return;
      const elapsed = Date.now() - cycleStart;
      if (elapsed >= interval) fire();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(tickId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [open, router]);

  if (open === null) return null;

  // SVG ring that drains over the current cycle.
  const size = 14;
  const stroke = 2;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dashOffset = c * progress;
  const tooltipSec = (open ? INTERVAL_OPEN_MS : INTERVAL_CLOSED_MS) / 1000;

  return (
    <span
      role="presentation"
      title={`Hər ${tooltipSec} saniyədə bir avtomatik yenilənir`}
      className="inline-flex items-center justify-center align-middle"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(22, 163, 74, 0.18)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgb(22, 163, 74)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 100ms linear" }}
        />
      </svg>
    </span>
  );
}
