"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatUnits } from "@/lib/portfolio";
import type { OrderRow } from "@/lib/market";

const price2 = (n: number) => `${n.toFixed(2)} ₼`;

const STATUS_LABEL: Record<OrderRow["status"], string> = {
  open: "Açıq",
  partial: "Qismən",
  filled: "Tamamlandı",
  cancelled: "Ləğv edildi",
};

export function MyOrders({ orders }: { orders: OrderRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cancel = async (id: string) => {
    setBusy(id);
    setError(null);
    const res = await fetch("/api/orders", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: id }),
    });
    const json = await res.json();
    setBusy(null);
    if (!res.ok) {
      setError(json.error ?? "Ləğv edilmədi.");
      return;
    }
    router.refresh();
  };

  const remove = async (id: string) => {
    setBusy(id);
    setError(null);
    const res = await fetch("/api/orders", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: id, mode: "delete" }),
    });
    const json = await res.json();
    setBusy(null);
    if (!res.ok) {
      setError(json.error ?? "Silinmədi.");
      return;
    }
    router.refresh();
  };

  return (
    <div className="glass flex flex-col gap-4 p-6">
      <div className="text-[10px] uppercase tracking-[0.22em] text-brand-green/80">
        Sifarişlərim
      </div>
      {error && <div className="text-xs text-brand-red dark:text-red-400">{error}</div>}
      {orders.length === 0 ? (
        <div className="py-4 text-center text-xs text-black/45 dark:text-white/50">Hələ sifariş yoxdur.</div>
      ) : (
        <div className="flex flex-col divide-y divide-[rgba(22,163,74,0.12)]">
          {orders.map((o) => {
            const active = o.status === "open" || o.status === "partial";
            return (
              <div key={o.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                      o.side === "sell"
                        ? "bg-brand-red/10 text-brand-red dark:text-red-400"
                        : "bg-brand-green/10 text-brand-green dark:text-emerald-400"
                    }`}
                  >
                    {o.side === "sell" ? "Sat" : "Al"}
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <span className="num truncate text-sm text-black dark:text-white/90">
                      {formatUnits(o.remaining_units)} / {formatUnits(o.units)} pay
                    </span>
                    <span className="truncate text-[11px] text-black/45 dark:text-white/50">
                      {price2(o.price)} · {STATUS_LABEL[o.status]}
                    </span>
                  </div>
                </div>
                {active ? (
                  <button
                    onClick={() => cancel(o.id)}
                    disabled={busy === o.id}
                    className="shrink-0 rounded-full border border-black/10 dark:border-white/15 px-3 py-1.5 text-[11px] font-medium text-black/55 dark:text-white/60 transition hover:border-brand-red hover:text-brand-red dark:hover:text-red-400 disabled:opacity-50"
                  >
                    {busy === o.id ? "..." : "Ləğv et"}
                  </button>
                ) : (
                  <button
                    onClick={() => remove(o.id)}
                    disabled={busy === o.id}
                    aria-label="Sifarişi sil"
                    className="shrink-0 rounded-full border border-black/10 dark:border-white/15 px-3 py-1.5 text-[11px] font-medium text-black/55 dark:text-white/60 transition hover:border-brand-red hover:text-brand-red dark:hover:text-red-400 disabled:opacity-50"
                  >
                    {busy === o.id ? "..." : "Sil"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
