"use client";

import { useEffect, useState } from "react";

// The VAPID public key is public by design (handed to every client + the push
// service), so it's safe to ship as a fallback. This way the "enable" button
// works even if NEXT_PUBLIC_VAPID_PUBLIC_KEY wasn't set at build time.
const VAPID_PUBLIC =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  "BPpa36JzM4PgP4PBBvCukwt8QiyHuJ8GIar2h43jwMNEcPafVYLEJtaQmT2LG4fFbVLNGbTgc1dDmyyE5UCutBg";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i);
  return arr;
}

type State = "loading" | "unsupported" | "denied" | "idle" | "subscribed";

// Shown inside the notifications bell: lets the user turn on push notifications
// (app-icon badge + banner). On iOS this only works in the installed PWA.
export function PushControls() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window) ||
        !VAPID_PUBLIC
      ) {
        setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setState("denied");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setState(sub ? "subscribed" : "idle");
      } catch {
        setState("idle");
      }
    })();
  }, []);

  const enable = async () => {
    if (!VAPID_PUBLIC) return;
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "idle");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (res.ok) setState("subscribed");
    } catch {
      // user dismissed / transient error
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading" || state === "unsupported") return null;

  if (state === "subscribed") {
    return (
      <div className="border-b border-black/[0.06] px-4 py-2 text-[10px] text-brand-green/80">
        Push bildirişləri aktivdir ✓
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="border-b border-black/[0.06] px-4 py-2 text-[10px] text-black/45 dark:text-white/50">
        Bildirişlər brauzer tərəfindən bloklanıb.
      </div>
    );
  }

  return (
    <button
      onClick={enable}
      disabled={busy}
      className="w-full border-b border-black/[0.06] px-4 py-2 text-left text-[11px] font-medium text-brand-green dark:text-emerald-400 transition hover:bg-brand-green/[0.06] disabled:opacity-50"
    >
      {busy ? "Aktivləşdirilir..." : "🔔 Push bildirişlərini aktiv et"}
    </button>
  );
}
