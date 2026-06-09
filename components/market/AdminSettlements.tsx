"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatUnits } from "@/lib/portfolio";
import type { TradeRow } from "@/lib/market";

const price2 = (n: number) => `${n.toFixed(2)} ₼`;

const KIND_LABEL: Record<TradeRow["counterparty_kind"], string> = {
  p2p: "İştirakçılar arası",
  fund_buy: "Fonda satış",
  fund_sell: "Fonddan alış",
};

export function AdminSettlements({ pending }: { pending: TradeRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const act = async (tradeId: string, action: "confirm" | "reject") => {
    setBusy(tradeId + action);
    setError(null);
    const res = await fetch("/api/admin/trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, tradeId }),
    });
    const json = await res.json();
    setBusy(null);
    if (!res.ok) {
      setError(json.error ?? "Əməliyyat alınmadı.");
      return;
    }
    router.refresh();
  };

  const sync = async () => {
    setBusy("sync");
    setError(null);
    setSyncMsg(null);
    const res = await fetch("/api/admin/sync-balances", { method: "POST" });
    const json = await res.json();
    setBusy(null);
    if (!res.ok) {
      setError(json.error ?? "Sinxronizasiya alınmadı.");
      return;
    }
    setSyncMsg(`Sinxronizasiya tamamlandı: ${json.synced ?? 0} sahib.`);
    router.refresh();
  };

  return (
    <div className="glass-tinted flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] uppercase tracking-[0.22em] text-brand-green/80">
          İdarəetmə · Hesablaşmalar
        </div>
        <button
          onClick={sync}
          disabled={busy === "sync"}
          className="rounded-full border border-brand-green/30 bg-white/70 dark:bg-white/10 px-3 py-1.5 text-[11px] font-medium text-black/70 dark:text-white/75 transition hover:border-brand-green hover:text-brand-green dark:hover:text-emerald-400 disabled:opacity-50"
        >
          {busy === "sync" ? "Sinxronlaşır..." : "Cədvəldən sinxronla"}
        </button>
      </div>

      {syncMsg && <div className="text-xs text-brand-green dark:text-emerald-400">{syncMsg}</div>}
      {error && <div className="text-xs text-brand-red dark:text-red-400">{error}</div>}

      {pending.length === 0 ? (
        <div className="py-3 text-center text-xs text-black/45 dark:text-white/50">
          Təsdiq gözləyən uyğunlaşma yoxdur.
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-[rgba(22,163,74,0.12)]">
          {pending.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 py-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm text-black dark:text-white/90">
                  <span className="font-medium">{t.seller_name}</span>
                  {" → "}
                  <span className="font-medium">{t.buyer_name}</span>
                </span>
                <span className="text-[11px] text-black/45 dark:text-white/50">
                  <span className="num">{formatUnits(t.units)}</span> pay ·{" "}
                  <span className="num">{price2(t.price)}</span> · {KIND_LABEL[t.counterparty_kind]}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => act(t.id, "confirm")}
                  disabled={busy === t.id + "confirm"}
                  className="rounded-full bg-brand-green px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition hover:-translate-y-0.5 disabled:opacity-50"
                >
                  {busy === t.id + "confirm" ? "..." : "Təsdiqlə"}
                </button>
                <button
                  onClick={() => act(t.id, "reject")}
                  disabled={busy === t.id + "reject"}
                  className="rounded-full border border-black/10 dark:border-white/15 px-3 py-1.5 text-[11px] font-medium text-black/55 dark:text-white/60 transition hover:border-brand-red hover:text-brand-red dark:hover:text-red-400 disabled:opacity-50"
                >
                  {busy === t.id + "reject" ? "..." : "Rədd et"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
