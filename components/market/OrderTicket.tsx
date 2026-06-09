"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { formatUnits } from "@/lib/portfolio";
import type { MarketStatus } from "@/lib/market";

const price2 = (n: number) => `${n.toFixed(2)} ₼`;

export function OrderTicket({
  status,
  availableToSell,
}: {
  status: MarketStatus;
  availableToSell: number;
}) {
  const router = useRouter();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [units, setUnits] = useState("");
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const u = Number(units);
  const p = Number(price);
  const validU = Number.isFinite(u) && u > 0;
  const validP = Number.isFinite(p) && p > 0;
  const total = validU && validP ? u * p : 0;
  const fundSellActive = status.fund_sell_capacity > 0;

  // Neither side makes sense below the Fund buyback (Satış): the Fund itself
  // bids that price, so a lower order could never fill. Sell offers are also
  // capped at 1.5x the Fund offer (Fonddan alış) as an upper sanity bound.
  const maxSell = Number((status.alis * 1.5).toFixed(2));
  const belowFloor = validP && p < status.satis;
  const aboveCap = side === "sell" && validP && p > maxSell;
  let hint: string | null = null;
  if (belowFloor) {
    hint =
      side === "sell"
        ? `Satış qiyməti ən az ${price2(status.satis)} olmalıdır.`
        : `Alış qiyməti ən az ${price2(status.satis)} olmalıdır — Fond payları bu qiymətə geri alır.`;
  } else if (aboveCap) {
    hint = `Satış qiyməti ən çox ${price2(maxSell)} ola bilər (Fonddan alış qiymətinin 1.5 misli).`;
  } else if (side === "sell" && validU && u > availableToSell) {
    hint = `Sata biləcəyiniz maksimum: ${formatUnits(availableToSell)} pay.`;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!validU || !validP) {
      setError("Pay sayı və qiymət düzgün daxil edilməlidir.");
      return;
    }
    if (belowFloor) {
      setError(`Qiymət ən az ${price2(status.satis)} olmalıdır.`);
      return;
    }
    if (aboveCap) {
      setError(`Satış qiyməti ən çox ${price2(maxSell)} ola bilər.`);
      return;
    }
    setLoading(true);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ side, units: u, price: p }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json.error ?? "Sifariş yerləşdirilmədi.");
      return;
    }
    const fills: Array<{ units: number }> = json.result?.fills ?? [];
    const remaining = Number(json.result?.remaining ?? 0);
    const filled = fills.reduce((s, f) => s + Number(f.units), 0);
    setSuccess(
      filled > 0
        ? `${formatUnits(filled)} pay uyğunlaşdırıldı (İsmayılın təsdiqi gözlənilir). Kitabda qalan: ${formatUnits(remaining)} pay.`
        : `Sifariş kitaba əlavə edildi: ${formatUnits(remaining)} pay gözləyir.`,
    );
    setUnits("");
    setPrice("");
    router.refresh();
  };

  return (
    <div className="glass flex flex-col gap-5 p-6">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.22em] text-brand-green/80">
          Sifariş ver
        </div>
        <div className="flex gap-1 rounded-full bg-black/5 p-1">
          <button
            type="button"
            onClick={() => setSide("buy")}
            className={`rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em] transition ${
              side === "buy" ? "bg-brand-green text-white shadow-sm" : "text-black/45"
            }`}
          >
            Al
          </button>
          <button
            type="button"
            onClick={() => setSide("sell")}
            className={`rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em] transition ${
              side === "sell" ? "bg-brand-red text-white shadow-sm" : "text-black/45"
            }`}
          >
            Sat
          </button>
        </div>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field
          label="Pay sayı"
          value={units}
          onChange={setUnits}
          placeholder="0"
          suffix={
            side === "sell" ? `mövcud: ${formatUnits(availableToSell)}` : undefined
          }
        />
        <Field
          label="Qiymət (1 pay)"
          value={price}
          onChange={setPrice}
          placeholder="0.00"
          suffix="₼"
        />

        <div className="flex flex-wrap gap-2">
          {side === "sell" ? (
            <Shortcut label={`Fonda sat — ${price2(status.satis)}`} onClick={() => setPrice(String(status.satis))} />
          ) : (
            <Shortcut
              label={
                fundSellActive
                  ? `Fonddan al — ${price2(status.alis)}`
                  : "Fond hazırda satmır"
              }
              onClick={() => fundSellActive && setPrice(String(status.alis))}
              disabled={!fundSellActive}
            />
          )}
        </div>

        <div className="flex items-baseline justify-between border-t border-brand-green/18 pt-3 text-sm">
          <span className="text-black/55">Cəmi (təxmini)</span>
          <span className="num font-bold text-black">{price2(total)}</span>
        </div>

        {hint && <div className="text-xs text-brand-red">{hint}</div>}
        {error && <div className="text-xs text-brand-red">{error}</div>}
        {success && <div className="text-xs text-brand-green">{success}</div>}

        <motion.button
          type="submit"
          disabled={loading || belowFloor || aboveCap}
          whileTap={{ scale: 0.98 }}
          className={`mt-1 rounded-xl px-4 py-3 text-sm font-medium uppercase tracking-[0.18em] text-white transition hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0 ${
            side === "sell" ? "bg-brand-red" : "bg-brand-green"
          }`}
        >
          {loading ? "Göndərilir..." : side === "sell" ? "Satış sifarişi ver" : "Alış sifarişi ver"}
        </motion.button>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  suffix?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-[10px] uppercase tracking-[0.22em] text-black/45">{label}</label>
        {suffix && <span className="text-[10px] text-black/45">{suffix}</span>}
      </div>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="num border-b border-brand-green/28 bg-transparent px-0 py-2 text-lg text-black outline-none transition focus:border-brand-green"
      />
    </div>
  );
}

function Shortcut({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-full border border-brand-green/28 bg-white/60 px-3 py-1.5 text-[11px] font-medium text-black/70 transition hover:border-brand-green hover:text-brand-green disabled:opacity-50 disabled:hover:border-brand-green/28 disabled:hover:text-black/70"
    >
      {label}
    </button>
  );
}
