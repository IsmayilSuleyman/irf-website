"use client";

import { useEffect, useState, type ReactNode } from "react";
import { formatUnits } from "@/lib/portfolio";
import type { BondSeries, BondBookLevel } from "@/lib/bonds";

const price2 = (n: number) => `${n.toFixed(2)} ₼`;
const GREEN = "#16a34a";
const RED = "#dc2626";

type Order = { units: number; holderName: string };
type Bar = {
  price: number;
  side: "buy" | "sell";
  bank: boolean; // bank's unsold primary issue (striped)
  units: number;
  orders: Order[];
};

function aggregate(levels: BondBookLevel[], side: "buy" | "sell"): Bar[] {
  const m = new Map<number, Bar>();
  for (const l of levels) {
    const e = m.get(l.price) ?? { price: l.price, side, bank: false, units: 0, orders: [] };
    e.units += l.units;
    e.orders.push({ units: l.units, holderName: l.holderName });
    m.set(l.price, e);
  }
  return [...m.values()];
}

function barBackground(side: "buy" | "sell", bank: boolean) {
  const color = side === "buy" ? GREEN : RED;
  // The bank's primary-issue bar is striped so it reads as standing liquidity.
  return bank ? `repeating-linear-gradient(45deg, ${color} 0 5px, ${color}80 5px 10px)` : color;
}

export function BondBook({
  series,
  book,
}: {
  series: BondSeries;
  book: BondBookLevel[];
}) {
  const [selected, setSelected] = useState<Bar | null>(null);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const participants = [
    ...aggregate(book.filter((b) => b.side === "buy"), "buy"),
    ...aggregate(book.filter((b) => b.side === "sell"), "sell"),
  ];

  // The bank's unsold primary issue shows as one striped SELL bar.
  const primaryOpen = series.status === "active" && series.primary_available > 0;
  const bankBars: Bar[] = primaryOpen
    ? [
        {
          price: series.issue_price_azn,
          side: "sell",
          bank: true,
          units: series.primary_available,
          orders: [],
        },
      ]
    : [];

  const bars = [...bankBars, ...participants].sort((a, b) => a.price - b.price);

  // Ordinal axis: one equal-width slot per distinct price (outliers can't crush it).
  const nominal = series.face_value_azn;
  const axisPrices = Array.from(new Set([nominal, ...bars.map((b) => b.price)])).sort(
    (a, b) => a - b,
  );
  const slotCount = Math.max(1, axisPrices.length);
  const slotOf = new Map(axisPrices.map((p, i): [number, number] => [p, i]));
  const pos = (p: number) => {
    const i = slotOf.get(p) ?? axisPrices.filter((x) => x < p).length;
    return ((i + 0.5) / slotCount) * 100;
  };

  const maxUnits = Math.max(1, ...bars.map((b) => b.units));
  const heightPct = (b: Bar) => (b.units / maxUnits) * 100;

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/10 p-6">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-bank-blue dark:text-blue-400">
        Sifarişlər Kitabçası
      </div>

      {/* Legend chips: nominal, issue price + primary remainder, best bid */}
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-black/5 px-2.5 py-1">
          <span className="text-[9px] uppercase tracking-[0.14em] text-black/45 dark:text-white/50">
            Nominal
          </span>
          <span className="num font-semibold text-black dark:text-white/90">
            {price2(series.face_value_azn)}
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-red/10 px-2.5 py-1">
          <span className="font-semibold text-brand-red dark:text-red-400">Buraxılış</span>
          <span className="num text-brand-red dark:text-red-400">
            {price2(series.issue_price_azn)}
          </span>
          <span className="text-black/45 dark:text-white/50">
            {series.primary_available > 0
              ? `· ${formatUnits(series.primary_available)} ədəd qalıb`
              : "· bitib"}
          </span>
        </span>
        {series.best_bid != null && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-green/10 px-2.5 py-1">
            <span className="font-semibold text-brand-green dark:text-emerald-400">
              Ən yaxşı alış
            </span>
            <span className="num text-brand-green dark:text-emerald-400">
              {price2(series.best_bid)}
            </span>
          </span>
        )}
      </div>

      {/* Histogram: bank primary issue + participant orders by price (bars are clickable) */}
      <div className="flex flex-col gap-1">
        <div className="relative h-44">
          {/* nominal (face value) marker */}
          <div
            className="absolute bottom-0 top-0 w-px -translate-x-1/2 bg-black/40 dark:bg-white/40"
            style={{ left: `${pos(nominal)}%` }}
          />
          {/* baseline */}
          <div className="absolute inset-x-0 bottom-0 h-px bg-black/15 dark:bg-white/15" />
          {/* bars */}
          {bars.map((b, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSelected(b)}
              aria-label={
                b.bank
                  ? `Bankdan alış ${price2(b.price)} — ${formatUnits(b.units)} istiqraz`
                  : `${price2(b.price)} — ${formatUnits(b.units)} istiqraz, ${b.orders.length} sifariş`
              }
              className="group absolute bottom-0 w-4 -translate-x-1/2 cursor-pointer rounded-t shadow-sm transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/40"
              style={{
                left: `${pos(b.price)}%`,
                height: `${heightPct(b)}%`,
                minHeight: "6px",
                background: barBackground(b.side, b.bank),
              }}
            >
              <span className="num pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] text-black/55 dark:text-white/60">
                {formatUnits(b.units)}
              </span>
            </button>
          ))}
        </div>
        {/* price axis: one label per slot */}
        <div className="relative h-4">
          {axisPrices.map((p, i) => (
            <span
              key={i}
              className="num absolute -translate-x-1/2 text-[9px] text-black/45 dark:text-white/50"
              style={{ left: `${pos(p)}%` }}
            >
              {p.toFixed(2)}
            </span>
          ))}
        </div>
      </div>

      <p className="text-[10px] leading-relaxed text-black/45 dark:text-white/50">
        Zolaqlı sütun bankın ilkin buraxılışıdır, dolu sütunlar iştirakçı sifarişləridir —
        ətraflı üçün üzərinə klikləyin.
        {participants.length === 0 && " Hələ iştirakçı sifarişi yoxdur."}
      </p>

      {selected && (
        <OrderPopup bar={selected} series={series} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function OrderPopup({
  bar,
  series,
  onClose,
}: {
  bar: Bar;
  series: BondSeries;
  onClose: () => void;
}) {
  const isBuy = bar.side === "buy";
  const color = isBuy
    ? "text-brand-green dark:text-emerald-400"
    : "text-brand-red dark:text-red-400";

  let title: string;
  let meta: ReactNode;
  let body: ReactNode = null;

  if (bar.bank) {
    title = "Bankdan alış";
    meta = <>Bank · {formatUnits(bar.units)} istiqraz</>;
    body = (
      <p className="mt-3 border-t border-black/10 dark:border-white/15 pt-3 text-xs leading-relaxed text-black/55 dark:text-white/60">
        Bank bu qiymətə {formatUnits(series.primary_available)} istiqraza qədər satır (ilkin
        buraxılış).
      </p>
    );
  } else {
    title = isBuy ? "Alış sifarişi" : "Satış sifarişi";
    meta = (
      <>
        Cəmi{" "}
        <span className="num text-black/70 dark:text-white/75">{formatUnits(bar.units)}</span>{" "}
        istiqraz · {bar.orders.length} sifariş
      </>
    );
    const orders = [...bar.orders].sort((a, b) => b.units - a.units);
    body = (
      <div className="mt-4 flex flex-col gap-1.5 border-t border-black/10 dark:border-white/15 pt-3">
        {orders.map((o, i) => (
          <div key={i} className="flex items-center justify-between gap-3 text-xs">
            <span className="truncate text-black/70 dark:text-white/75">
              {o.holderName || "Naməlum"}
            </span>
            <span className="num shrink-0 text-black/45 dark:text-white/50">
              {formatUnits(o.units)} istiqraz
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/30 dark:bg-white/30 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-[260px] rounded-2xl border border-black/10 dark:border-white/10 bg-white/95 dark:bg-neutral-900/95 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Bağla"
          className="absolute right-3 top-3 text-black/45 dark:text-white/50 transition hover:text-black/70 dark:hover:text-white/75"
        >
          ✕
        </button>

        <div className={`text-[11px] font-semibold ${color}`}>{title}</div>
        <div className="mt-1">
          <span className={`num text-2xl font-bold ${color}`}>{price2(bar.price)}</span>
        </div>
        <div className="mt-1 text-[11px] text-black/45 dark:text-white/50">{meta}</div>
        {body}
      </div>
    </div>
  );
}
