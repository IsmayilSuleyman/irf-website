"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Silently re-requests the current route on an interval. Rendered by
 * server pages inside a "data temporarily unavailable" state, so the page
 * heals itself as soon as the upstream (Google Sheets) recovers — the
 * component unmounts when the real content renders. An interval (not a
 * one-shot timeout) because router.refresh() re-renders server components
 * without remounting client ones: a still-failing refresh must try again.
 */
export function AutoRetry({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(t);
  }, [router, intervalMs]);
  return (
    <span
      aria-hidden
      className="mx-auto mt-4 block h-5 w-5 animate-spin rounded-full border-2 border-brand-green/30 border-t-brand-green"
    />
  );
}
