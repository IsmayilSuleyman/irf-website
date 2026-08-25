"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { currentUsSession, type ExtendedMode } from "@/lib/marketHours";

// The 3-5s ticker: a context provider that polls /api/live-pricing and
// hands the CURRENT fund-wide delta to every subscribed figure. The page
// still server-renders with the render-time delta (passed as `initial`,
// so hydration matches exactly); from then on the numbers retick between
// full refreshes — the Odometer they already sit in animates each step.
//
// Failure discipline: a failed or not-ok poll KEEPS the last value. The
// numbers may go briefly stale; they never snap to zero and back.

export type LivePricingState = {
  deltaAzn: number;
  mode: ExtendedMode | null;
  asOfMs: number | null;
};

const LivePricingContext = createContext<LivePricingState | null>(null);

/** The live fund-wide delta, or null outside a provider (SSR-safe). */
export function useLivePricing(): LivePricingState | null {
  return useContext(LivePricingContext);
}

// Poll fast while prices actually move (regular/pre/post), slow while the
// overnight fold is pinned to the after-market close. Hidden tabs pause.
const POLL_LIVE_MS = 4_000;
const POLL_FROZEN_MS = 30_000;

export function LivePricingProvider({
  initial,
  children,
}: {
  initial: LivePricingState;
  children: ReactNode;
}) {
  const [state, setState] = useState<LivePricingState>(initial);
  const inFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function poll() {
      if (cancelled) return;
      if (document.visibilityState === "visible" && !inFlightRef.current) {
        inFlightRef.current = true;
        try {
          const res = await fetch("/api/live-pricing", { cache: "no-store" });
          if (res.ok) {
            const j = (await res.json()) as {
              ok?: boolean;
              deltaAzn?: number;
              mode?: ExtendedMode | null;
              asOfMs?: number | null;
            };
            if (!cancelled && j.ok && Number.isFinite(j.deltaAzn)) {
              setState({
                deltaAzn: j.deltaAzn as number,
                mode: j.mode ?? null,
                asOfMs: j.asOfMs ?? null,
              });
            }
          }
        } catch {
          // keep the last value
        } finally {
          inFlightRef.current = false;
        }
      }
      if (cancelled) return;
      const session = currentUsSession();
      const base = session === "overnight" ? POLL_FROZEN_MS : POLL_LIVE_MS;
      // ±10% jitter so a family of tabs doesn't fire in lockstep.
      const delay = base * (0.9 + Math.random() * 0.2);
      timer = window.setTimeout(poll, delay);
    }

    // First poll after one interval — the server-rendered figures are
    // already current at mount.
    timer = window.setTimeout(poll, POLL_LIVE_MS);

    function onVisible() {
      if (document.visibilityState === "visible" && !cancelled) {
        window.clearTimeout(timer);
        void poll();
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return (
    <LivePricingContext.Provider value={state}>
      {children}
    </LivePricingContext.Provider>
  );
}
