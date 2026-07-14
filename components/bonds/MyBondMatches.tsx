"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatUnits } from "@/lib/portfolio";
import type { BondTradeRow } from "@/lib/bonds";

const price2 = (n: number) => `${n.toFixed(2)} ₼`;
const norm = (s: string) => s.trim().toLocaleLowerCase("az-AZ").replace(/\s+/g, " ");

export function MyBondMatches({
  trades,
  userId,
  holderName,
  seriesNames,
}: {
  trades: BondTradeRow[];
  userId: string;
  holderName: string | null;
  seriesNames: Record<string, string>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = trades.filter((t) => t.status !== "cancelled");

  const reject = async (id: string) => {
    setBusy(id);
    setError(null);
    const res = await fetch("/api/bonds/trades", {
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
    <div className="flex flex-col gap-4 rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/10 p-6">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-bank-blue dark:text-blue-400">
        İstiqraz uyğunlaşmalarım
      </div>
      {error && <div className="text-xs text-brand-red dark:text-red-400">{error}</div>}
      {visible.length === 0 ? (
        <div className="py-4 text-center text-xs text-black/45 dark:text-white/50">
          Hələ uyğunlaşma yoxdur.
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-black/5 dark:divide-white/10">
          {visible.map((t) => {
            const isBuyer =
              t.buyer_user_id === userId ||
              (!!holderName && norm(t.buyer_name) === norm(holderName));
            // The bank label only makes sense from the buyer's side; İsmayıl
            // (the seller on primary trades) should see the actual buyer.
            const counterparty = isBuyer
              ? t.counterparty_kind === "primary"
                ? "İsmayılBank (ilkin buraxılış)"
                : t.seller_name
              : t.buyer_name;
            const pending = t.status === "pending";
            return (
              <div key={t.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm text-black dark:text-white/90">
                    <span className={isBuyer ? "text-brand-green dark:text-emerald-400" : "text-brand-red dark:text-red-400"}>
                      {isBuyer ? "Aldınız" : "Satdınız"}
                    </span>{" "}
                    <span className="num">{formatUnits(t.units)}</span> istiqraz ·{" "}
                    <span className="num">{price2(t.price)}</span>
                  </span>
                  <span className="text-[11px] text-black/45 dark:text-white/50">
                    {seriesNames[t.series_id] ?? "—"} · {counterparty}
                    {pending ? " · İsmayıl ilə hesablaşma gözlənilir" : " · tamamlandı"}
                  </span>
                </div>
                {pending && (
                  <button
                    onClick={() => reject(t.id)}
                    disabled={busy === t.id}
                    className="rounded-full border border-black/10 dark:border-white/15 px-3 py-1.5 text-[11px] font-medium text-black/55 dark:text-white/60 transition hover:border-brand-red hover:text-brand-red dark:hover:text-red-400 disabled:opacity-50"
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
