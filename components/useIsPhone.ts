"use client";

import { useSyncExternalStore } from "react";

// Below Tailwind's `sm` breakpoint (640px) — the same line every `sm:`
// class in the app switches on, so JS-decided layout (recharts axis props,
// which no class can reach) flips exactly where the CSS does.
const QUERY = "(max-width: 639px)";

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

const getSnapshot = () => window.matchMedia(QUERY).matches;

// Server renders (and the hydration pass) assume desktop; the client value
// lands right after hydration — before recharts has measured its container
// and drawn anything, so the phone chart never paints desktop-first.
const getServerSnapshot = () => false;

/** True on phone-width viewports (under the `sm` breakpoint). */
export function useIsPhone(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
