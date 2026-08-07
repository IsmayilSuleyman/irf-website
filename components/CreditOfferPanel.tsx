"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatGrouped } from "@/lib/portfolio";
import type { CreditOffer, CreditOfferMode } from "@/lib/creditOffers";

// İsmayıl's cabinet panel: one credit offer per account, fixed ₼ or a
// percent of remaining liquidity. The list shows what each rule resolves to
// TODAY (percent rules move with the liquidity) and flags rules that are
// currently hidden because the account carries an active loan.

export function CreditOfferPanel({
  accountNames,
  loanHolders,
  offers,
  netLiquidityAzn,
}: {
  accountNames: string[];
  /** Accounts with an active loan — their offer exists but stays hidden. */
  loanHolders: string[];
  offers: CreditOffer[];
  netLiquidityAzn: number;
}) {
  const router = useRouter();
  const [holder, setHolder] = useState(accountNames[0] ?? "");
  const [mode, setMode] = useState<CreditOfferMode>("azn");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const hasLoan = (name: string) => loanHolders.includes(name);
  const resolved = (o: CreditOffer) =>
    o.mode === "azn"
      ? Math.floor(o.value)
      : Math.max(0, Math.floor((netLiquidityAzn * o.value) / 100));

  const preview = (() => {
    const v = Number(draft.trim().replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) return null;
    if (mode === "azn") return Math.floor(v);
    if (v > 100) return null;
    return Math.max(0, Math.floor((netLiquidityAzn * v) / 100));
  })();

  function submit() {
    setError(null);
    const value = Number(draft.trim().replace(",", "."));
    if (!holder) return setError("Hesab seçin.");
    if (!Number.isFinite(value) || value <= 0)
      return setError("Düzgün məbləğ daxil edin.");
    if (mode === "pct" && value > 100)
      return setError("Faiz 100-dən böyük ola bilməz.");
    startTransition(async () => {
      const res = await fetch("/api/admin/credit-offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holderName: holder, mode, value }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Yadda saxlanılmadı.");
        return;
      }
      setDraft("");
      router.refresh();
    });
  }

  function remove(name: string) {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/credit-offers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holderName: name }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Silinmədi.");
        return;
      }
      router.refresh();
    });
  }

  const inputCls =
    "rounded-xl border border-black/10 dark:border-white/15 bg-white/80 dark:bg-white/5 px-3 py-2 text-sm text-ink dark:text-white/90 outline-none focus:border-bank-blue/50";

  return (
    <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/10 p-5">
      <h3 className="text-[13px] font-semibold tracking-[-0.01em] text-ink dark:text-white/90">
        Kredit təklifləri
      </h3>
      <p className="mt-1 text-[11px] leading-4 text-black/45 dark:text-white/50">
        Hesab üzrə təklif: sabit ₼ və ya qalan likvidliyin{" "}
        <span className="num">({formatGrouped(netLiquidityAzn, 0)} ₼)</span>{" "}
        faizi kimi. Aktiv krediti olan hesaba banner göstərilmir.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={holder}
          onChange={(e) => setHolder(e.target.value)}
          disabled={pending}
          className={inputCls}
        >
          {accountNames.map((n) => (
            <option key={n} value={n}>
              {n}
              {hasLoan(n) ? " (kreditli)" : ""}
            </option>
          ))}
        </select>
        <span className="inline-flex overflow-hidden rounded-xl border border-black/10 dark:border-white/15">
          {(["azn", "pct"] as const).map((m) => (
            <button
              key={m}
              type="button"
              disabled={pending}
              onClick={() => setMode(m)}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                mode === m
                  ? "bg-bank-blue/15 text-bank-blue dark:text-blue-400"
                  : "text-black/45 hover:text-black/80 dark:text-white/50 dark:hover:text-white/85"
              }`}
            >
              {m === "azn" ? "₼" : "%"}
            </button>
          ))}
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={mode === "azn" ? "300" : "10"}
          disabled={pending}
          className={`num w-24 ${inputCls}`}
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-xl bg-bank-blue px-4 py-2 text-sm font-semibold text-white transition hover:bg-bank-blue-deep disabled:opacity-50"
        >
          {pending ? "Saxlanılır..." : "Yadda saxla"}
        </button>
      </div>
      {preview != null && mode === "pct" && (
        <p className="num mt-1.5 text-[11px] text-black/45 dark:text-white/50">
          ≈ {formatGrouped(preview, 0)} ₼ hazırkı likvidliyə görə
        </p>
      )}
      {error && (
        <p className="mt-2 text-xs text-status-late dark:text-rose-400">{error}</p>
      )}

      {offers.length > 0 && (
        <ul className="mt-4 flex flex-col divide-y divide-black/5 dark:divide-white/10 border-t border-black/10 dark:border-white/10">
          {offers.map((o) => (
            <li key={o.holderName} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-2.5">
              <span className="text-sm font-medium text-ink dark:text-white/90">
                {o.holderName}
              </span>
              <span className="num text-[12px] text-black/55 dark:text-white/60">
                {o.mode === "azn"
                  ? `${formatGrouped(o.value, 0)} ₼`
                  : `likvidliyin ${formatGrouped(o.value, 0)}%-i`}
              </span>
              <span className="num text-[12px] font-semibold text-bank-blue dark:text-blue-400">
                → {formatGrouped(resolved(o), 0)} ₼
              </span>
              {hasLoan(o.holderName) && (
                <span className="rounded-full bg-status-late-soft dark:bg-status-late/20 px-2 py-px text-[10px] font-medium text-status-late dark:text-rose-400">
                  gizli — aktiv kredit var
                </span>
              )}
              <button
                type="button"
                onClick={() => remove(o.holderName)}
                disabled={pending}
                className="ml-auto text-[11px] uppercase tracking-[0.14em] text-black/40 transition-colors hover:text-status-late dark:text-white/45 dark:hover:text-rose-400"
              >
                Sil
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
