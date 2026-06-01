"use client";

import { useEffect } from "react";

// Registers the PWA service worker (push + app-icon badge handlers live in
// /public/sw.js). No-op where service workers aren't supported.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // registration failures are non-fatal (e.g. unsupported / blocked)
    });
  }, []);
  return null;
}
