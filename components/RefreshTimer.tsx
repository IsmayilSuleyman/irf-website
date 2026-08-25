"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { revalidateSheetData } from "@/app/dashboard/refresh-actions";
import { currentUsSession } from "@/lib/marketHours";

// Cadence chosen against the Google Sheets API quota (60 reads/minute/user)
// AND against when the figures actually move:
//   - Regular session: 15s, with the sheet-tag revalidation (GOOGLEFINANCE
//     is live, one batchGet per refresh = one quota read).
//   - Pre/post: 30s, WITHOUT the sheet action — the sheet is frozen but the
//     extended fold moves live, so the refresh only re-renders against the
//     60s Yahoo quote cache. Zero Google reads.
//   - Overnight/weekend: 120s, also without the sheet action — the fold is
//     pinned to the after-market close; the slow tick still catches admin
//     edits and the daily NAV row.
// Hidden tabs don't tick at all.
const INTERVALS = { open: 15_000, ext: 30_000, closed: 120_000 } as const;

type Cadence = keyof typeof INTERVALS;

function cadenceNow(): Cadence {
  const s = currentUsSession();
  if (s === null) return "open";
  return s === "overnight" ? "closed" : "ext";
}

export function RefreshTimer() {
  const router = useRouter();
  const [cadence, setCadence] = useState<Cadence | null>(null);
  // 0 = just refreshed, 1 = about to refresh.
  const [progress, setProgress] = useState(0);
  const inFlightRef = useRef(false);

  // Watch the market state so the cadence flips on session boundaries.
  useEffect(() => {
    const update = () => setCadence(cadenceNow());
    update();
    const id = window.setInterval(update, 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Refresh loop. Re-mounts (and resets the cycle) whenever the cadence
  // changes, which is what we want — session boundaries should restart the
  // ring.
  useEffect(() => {
    if (cadence === null) return;
    const interval = INTERVALS[cadence];
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
        // The sheet-tag bust only pays off while GOOGLEFINANCE is live.
        if (cadence === "open") await revalidateSheetData();
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
  }, [cadence, router]);

  if (cadence === null) return null;

  // SVG ring that drains over the current cycle.
  const size = 14;
  const stroke = 2;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dashOffset = c * progress;
  const tooltipSec = INTERVALS[cadence] / 1000;

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
