"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatUnits } from "@/lib/portfolio";
import type { TradeRow } from "@/lib/market";

const price2 = (n: number) => `${n.toFixed(2)} ₼`;
const norm = (s: string) => s.trim().toLocaleLowerCase("az-AZ").replace(/\s+/g, " ");

export function MyMatches({
  trades,
  userId,
  holderName,
}: {
  trades: TradeRow[];
  userId: string;
  holderName: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = trades.filter((t) => t.status !== "cancelled");

  const reject = async (id: string) => {
    setBusy(id);
    setError(null);
    const res = await fetch("/api/trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", tradeId: id }),
    });
    const json = await res.json();
    setBusy(null);
    if (!res.ok) {
      setError(json.error ?? "Ləğv edilmədi.");
      return;
    }
    router.refresh();
  };

  return (
    <div className="glass flex flex-col gap-4 p-6">
      <div className="text-[10px] uppercase tracking-[0.22em] text-brand-green/80">
        Uyğunlaşmalarım
      </div>
      {error && <div className="text-xs text-brand-red">{error}</div>}
      {visible.length === 0 ? (
        <div className="py-4 text-center text-xs text-black/35">
          Hələ uyğunlaşma yoxdur.
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-[rgba(22,163,74,0.12)]">
          {visible.map((t) => {
            const isBuyer =
              t.buyer_user_id === userId ||
              (!!holderName && norm(t.buyer_name) === norm(holderName));
            const counterparty = isBuyer ? t.seller_name : t.buyer_name;
            const pending = t.status === "pending";
            return (
              <div key={t.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm text-black">
                    <span className={isBuyer ? "text-brand-green" : "text-brand-red"}>
                      {isBuyer ? "Aldınız" : "Satdınız"}
                    </span>{" "}
                    <span className="num">{formatUnits(t.units)}</span> pay ·{" "}
                    <span className="num">{price2(t.price)}</span>
                  </span>
                  <span className="text-[11px] text-black/45">
                    {counterparty}
                    {pending ? " · İsmayıl ilə hesablaşma gözlənilir" : " · tamamlandı"}
                  </span>
                </div>
                {pending && (
                  <button
                    onClick={() => reject(t.id)}
                    disabled={busy === t.id}
                    className="rounded-full border border-black/12 px-3 py-1.5 text-[11px] font-medium text-black/55 transition hover:border-brand-red hover:text-brand-red disabled:opacity-50"
                  >
                    {busy === t.id ? "..." : "Ləğv et"}
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
