"use client";

import { useEffect, useState } from "react";
import { nextUsMarketTransition } from "@/lib/marketHours";

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const clock = `${pad(h)}:${pad(m)}:${pad(s)}`;
  return days > 0 ? `${days} gün ${clock}` : clock;
}

export function MarketCountdown() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Render nothing until computed on the client (avoids a hydration mismatch).
  if (!now) return null;

  const { open, at } = nextUsMarketTransition(now);
  const remaining = at.getTime() - now.getTime();

  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-white/70 px-3 py-1.5 text-[11px] font-medium shadow-sm"
      title="ABŞ fond bazarları (NYSE/NASDAQ) iş saatları"
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${open ? "animate-pulse bg-brand-green" : "bg-black/30"}`}
      />
      <span className={open ? "text-brand-green" : "text-black/45"}>
        {open ? "ABŞ bazarları açıqdır" : "ABŞ bazarları bağlıdır"}
      </span>
      <span className="text-black/20">·</span>
      <span className="text-black/45">
        {open ? "Bağlanmağa" : "Açılmağa"}{" "}
        <span className="num tabular-nums text-black/70">{formatRemaining(remaining)}</span> qalıb
      </span>
    </span>
  );
}
