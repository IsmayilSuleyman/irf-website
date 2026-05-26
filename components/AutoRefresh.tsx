"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { revalidateSheetData } from "@/app/dashboard/refresh-actions";

const REFRESH_INTERVAL_MS = 60_000;

export function AutoRefresh() {
  const router = useRouter();
  const inFlightRef = useRef(false);
  const lastRunRef = useRef(0);

  useEffect(() => {
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

    const interval = window.setInterval(tick, REFRESH_INTERVAL_MS);

    function onVisible() {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastRunRef.current >= REFRESH_INTERVAL_MS) tick();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  return null;
}
