"use client";

import { useEffect, useRef, useState } from "react";
import type { NotificationRow } from "@/lib/notifications";
import { PushControls } from "@/components/PushControls";

type BadgeNav = Navigator & {
  setAppBadge?: (n?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return "indicə";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} dəq`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} saat`;
  return `${Math.floor(h / 24)} gün`;
}

export function NotificationsBell() {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.items ?? []);
      setUnread(json.unread ?? 0);
    } catch {
      // ignore transient fetch errors
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, []);

  // Mirror the unread count onto the installed app icon while the app is open.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("setAppBadge" in navigator)) return;
    const nav = navigator as BadgeNav;
    if (unread > 0) nav.setAppBadge?.(unread).catch(() => {});
    else nav.clearAppBadge?.().catch(() => {});
  }, [unread]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      try {
        await fetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
      } catch {
        // ignore
      }
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggle}
        aria-label="Bildirişlər"
        className="relative flex items-center text-black/55 transition hover:text-brand-green"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brand-red px-1 text-[9px] font-bold leading-none text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-16 z-50 overflow-hidden rounded-xl border border-black/10 bg-white/95 shadow-[0_18px_50px_rgba(48,94,63,0.18)] backdrop-blur-md sm:absolute sm:inset-x-auto sm:right-0 sm:top-9 sm:w-72 sm:max-w-[85vw]">
          <div className="border-b border-black/[0.07] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-green/80">
            Bildirişlər
          </div>
          <PushControls />
          {items.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-black/40">
              Bildiriş yoxdur.
            </div>
          ) : (
            <ul className="max-h-80 divide-y divide-black/[0.06] overflow-y-auto">
              {items.map((n) => (
                <li key={n.id} className={`px-4 py-3 ${n.read ? "" : "bg-brand-green/[0.04]"}`}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-semibold text-black">{n.title}</span>
                    <span className="shrink-0 text-[10px] text-black/35">{timeAgo(n.created_at)}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-black/55">{n.body}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
