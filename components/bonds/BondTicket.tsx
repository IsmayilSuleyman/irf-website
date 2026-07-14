"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { formatUnits } from "@/lib/portfolio";
import type { BondSeries } from "@/lib/bonds";

const price2 = (n: number) => `${n.toFixed(2)} ₼`;

export function BondTicket({ series }: { series: BondSeries }) {
  const router = useRouter();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [units, setUnits] = useState("");
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const u = Number(units);
  const p = Number(price);
  const validU = Number.isInteger(u) && u > 0;
  const validP = Number.isFinite(p) && p > 0;
  const total = validU && validP ? u * p : 0;

  // Mirrors the DB price bounds: 10%–200% of face value.
  const minPrice = Math.round(series.face_value_azn * 0.1 * 100) / 100;
  const maxPrice = Math.round(series.face_value_azn * 2 * 100) / 100;
  const outOfBounds = validP && (p < minPrice || p > maxPrice);
  const primaryActive = series.primary_available > 0;

  let hint: string | null = null;
  if (outOfBounds) {
    hint = `Qiymət ${price2(minPrice)} ilə ${price2(maxPrice)} arasında olmalıdır.`;
  } else if (side === "sell" && validU && u > series.my_available) {
    hint = `Sata biləcəyiniz maksimum: ${formatUnits(series.my_available)} istiqraz.`;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!validU) {
      setError("İstiqraz sayı müsbət tam ədəd olmalıdır.");
      return;
    }
    if (!validP) {
      setError("Qiymət düzgün daxil edilməlidir.");
      return;
    }
    if (outOfBounds) {
      setError(`Qiymət ${price2(minPrice)} ilə ${price2(maxPrice)} arasında olmalıdır.`);
      return;
    }
    setLoading(true);
    const res = await fetch("/api/bonds/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seriesId: series.id, side, units: u, price: p }),
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
        ? `${formatUnits(filled)} istiqraz uyğunlaşdırıldı (İsmayılın təsdiqi gözlənilir). Kitabda qalan: ${formatUnits(remaining)} istiqraz.`
        : `Sifariş kitaba əlavə edildi: ${formatUnits(remaining)} istiqraz gözləyir.`,
    );
    setUnits("");
    setPrice("");
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/10 p-6">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-bank-blue dark:text-blue-400">
          Sifariş ver
        </div>
        <div className="flex gap-1 rounded-full bg-black/5 dark:bg-white/10 p-1">
          <button
            type="button"
            onClick={() => setSide("buy")}
            className={`rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em] transition ${
              side === "buy" ? "bg-brand-green text-white shadow-sm" : "text-black/45 dark:text-white/50"
            }`}
          >
            Al
          </button>
          <button
            type="button"
            onClick={() => setSide("sell")}
            className={`rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em] transition ${
              side === "sell" ? "bg-brand-red text-white shadow-sm" : "text-black/45 dark:text-white/50"
            }`}
          >
            Sat
          </button>
        </div>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field
          label="İstiqraz sayı"
          value={units}
          onChange={setUnits}
          placeholder="0"
          integer
          suffix={
            side === "sell" ? `mövcud: ${formatUnits(series.my_available)}` : undefined
          }
        />
        <Field
          label="Qiymət (1 istiqraz)"
          value={price}
          onChange={setPrice}
          placeholder="0.00"
          suffix="₼"
        />

        <div className="flex flex-wrap gap-2">
          {side === "sell" ? (
            <Shortcut
              label={`Nominal dəyər — ${price2(series.face_value_azn)}`}
              onClick={() => setPrice(String(series.face_value_azn))}
            />
          ) : (
            <Shortcut
              label={
                primaryActive
                  ? `Bankdan al — ${price2(series.issue_price_azn)}`
                  : "Bank inventarı bitib"
              }
              onClick={() => primaryActive && setPrice(String(series.issue_price_azn))}
              disabled={!primaryActive}
            />
          )}
        </div>

        <div className="flex items-baseline justify-between border-t border-black/10 dark:border-white/10 pt-3 text-sm">
          <span className="text-black/55 dark:text-white/60">Cəmi (təxmini)</span>
          <span className="num font-bold text-black dark:text-white/90">{price2(total)}</span>
        </div>

        {hint && <div className="text-xs text-brand-red dark:text-red-400">{hint}</div>}
        {error && <div className="text-xs text-brand-red dark:text-red-400">{error}</div>}
        {success && <div className="text-xs text-brand-green dark:text-emerald-400">{success}</div>}

        <motion.button
          type="submit"
          disabled={loading || outOfBounds}
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
  integer,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  suffix?: string;
  integer?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-[10px] uppercase tracking-[0.22em] text-black/45 dark:text-white/50">{label}</label>
        {suffix && <span className="text-[10px] text-black/45 dark:text-white/50">{suffix}</span>}
      </div>
      <input
        type="number"
        inputMode={integer ? "numeric" : "decimal"}
        min="0"
        step={integer ? "1" : "any"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="num border-b border-black/10 dark:border-white/10 bg-transparent px-0 py-2 text-lg text-black dark:text-white/90 outline-none transition focus:border-bank-blue dark:focus:border-blue-400"
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
      className="rounded-full border border-black/10 dark:border-white/15 bg-white/60 dark:bg-white/5 px-3 py-1.5 text-[11px] font-medium text-black/70 dark:text-white/75 transition hover:border-bank-blue hover:text-bank-blue dark:hover:text-blue-400 disabled:opacity-50 disabled:hover:border-black/10 disabled:hover:text-black/70"
    >
      {label}
    </button>
  );
}
