"use client";

import { useEffect, useState } from "react";
import { isUsMarketOpen } from "@/lib/marketHours";

export function MarketHoursBadge() {
  const [open, setOpen] = useState<boolean | null>(null);

  useEffect(() => {
    const update = () => setOpen(isUsMarketOpen());
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, []);

  // Avoid a hydration mismatch — only render once computed on the client.
  if (open === null) return null;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-black/8 bg-white/70 px-2.5 py-1 text-[10px] font-medium"
      title="ABŞ fond bazarları (NYSE/NASDAQ) iş saatları"
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${open ? "animate-pulse bg-brand-green" : "bg-black/30"}`}
      />
      <span className={open ? "text-brand-green" : "text-black/45"}>
        {open ? "ABŞ bazarları açıqdır" : "ABŞ bazarları bağlıdır"}
      </span>
    </span>
  );
}
