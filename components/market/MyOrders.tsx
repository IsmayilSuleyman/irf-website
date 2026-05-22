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
      {error && <div className="text-xs text-brand-red">{error}</div>}
      {orders.length === 0 ? (
        <div className="py-4 text-center text-xs text-black/35">Hələ sifariş yoxdur.</div>
      ) : (
        <div className="flex flex-col divide-y divide-[rgba(22,163,74,0.12)]">
          {orders.map((o) => {
            const active = o.status === "open" || o.status === "partial";
            return (
              <div key={o.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                      o.side === "sell"
                        ? "bg-brand-red/10 text-brand-red"
                        : "bg-brand-green/10 text-brand-green"
                    }`}
                  >
                    {o.side === "sell" ? "Sat" : "Al"}
                  </span>
                  <div className="flex flex-col">
                    <span className="num text-sm text-black">
                      {formatUnits(o.remaining_units)} / {formatUnits(o.units)} pay
                    </span>
                    <span className="text-[11px] text-black/45">
                      {price2(o.price)} · {STATUS_LABEL[o.status]}
                    </span>
                  </div>
                </div>
                {active ? (
                  <button
                    onClick={() => cancel(o.id)}
                    disabled={busy === o.id}
                    className="rounded-full border border-black/12 px-3 py-1.5 text-[11px] font-medium text-black/60 transition hover:border-brand-red hover:text-brand-red disabled:opacity-50"
                  >
                    {busy === o.id ? "..." : "Ləğv et"}
                  </button>
                ) : (
                  <button
                    onClick={() => remove(o.id)}
                    disabled={busy === o.id}
                    aria-label="Sifarişi sil"
                    className="rounded-full border border-black/12 px-3 py-1.5 text-[11px] font-medium text-black/45 transition hover:border-brand-red hover:text-brand-red disabled:opacity-50"
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
