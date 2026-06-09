"use client";

import { useEffect, useState, type ReactNode } from "react";
import { formatUnits } from "@/lib/portfolio";
import type { BookLevel, MarketStatus } from "@/lib/market";

const price2 = (n: number) => `${n.toFixed(2)} ₼`;
const GREEN = "#16a34a";
const RED = "#dc2626";

type Order = { units: number; holderName: string };
type Bar = {
  price: number;
  side: "buy" | "sell";
  fund: boolean;
  units: number | null; // null = unlimited (fund buyback)
  orders: Order[];
};

function aggregate(levels: BookLevel[], side: "buy" | "sell"): Bar[] {
  const m = new Map<number, Bar>();
  for (const l of levels) {
    const e = m.get(l.price) ?? { price: l.price, side, fund: false, units: 0, orders: [] };
    e.units = (e.units ?? 0) + l.units;
    e.orders.push({ units: l.units, holderName: l.holderName });
    m.set(l.price, e);
  }
  return [...m.values()];
}

function barBackground(side: "buy" | "sell", fund: boolean) {
  const color = side === "buy" ? GREEN : RED;
  // Fund bars are striped so they read as standing market-maker liquidity.
  return fund ? `repeating-linear-gradient(45deg, ${color} 0 5px, ${color}80 5px 10px)` : color;
}

export function OrderBook({
  book,
  status,
}: {
  book: BookLevel[];
  status: MarketStatus;
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

  const fundSellActive = status.fund_sell_capacity > 0;
  const bid = status.satis; // fund buyback — you sell to the fund here
  const ask = fundSellActive ? status.alis : null; // fund offer — you buy from the fund here
  const current = status.unit_price;

  const participants = [
    ...aggregate(book.filter((b) => b.side === "buy"), "buy"),
    ...aggregate(book.filter((b) => b.side === "sell"), "sell"),
  ];

  // The Fund is always-on liquidity, so show its quotes as bars too.
  const fundBars: Bar[] = [
    { price: bid, side: "buy", fund: true, units: null, orders: [] },
    ...(ask != null
      ? [{ price: ask, side: "sell", fund: true, units: status.fund_sell_capacity, orders: [] } as Bar]
      : []),
  ];

  const bars = [...fundBars, ...participants].sort((a, b) => a.price - b.price);

  // Ordinal axis: one equal-width slot per distinct price (outliers can't crush it).
  const axisPrices = Array.from(new Set([current, ...bars.map((b) => b.price)])).sort((a, b) => a - b);
  const slotCount = Math.max(1, axisPrices.length);
  const slotOf = new Map(axisPrices.map((p, i): [number, number] => [p, i]));
  const pos = (p: number) => {
    const i = slotOf.get(p) ?? axisPrices.filter((x) => x < p).length;
    return ((i + 0.5) / slotCount) * 100;
  };

  const maxUnits = Math.max(
    1,
    ...(ask != null ? [status.fund_sell_capacity] : []),
    ...participants.map((b) => b.units ?? 0),
  );
  const heightPct = (b: Bar) => (b.units == null ? 100 : (b.units / maxUnits) * 100);
  const topLabel = (b: Bar) => (b.units == null ? "∞" : formatUnits(b.units));

  return (
    <div className="glass flex flex-col gap-5 p-6">
      <div className="text-[10px] uppercase tracking-[0.22em] text-brand-green/80">
        Sifarişlər Kitabçası
      </div>

      {/* Fund quotes + current price (legend for the bars below) */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-green/10 px-2.5 py-1">
          <span className="font-semibold text-brand-green dark:text-emerald-400">Fonda satış</span>
          <span className="num text-brand-green dark:text-emerald-400">{price2(bid)}</span>
          <span className="text-black/45 dark:text-white/50">· limitsiz</span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] px-2.5 py-1">
          <span className="text-[9px] uppercase tracking-[0.14em] text-black/45 dark:text-white/50">Hazırki</span>
          <span className="num font-semibold text-black dark:text-white/90">{price2(current)}</span>
        </span>
        {ask != null ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-red/10 px-2.5 py-1">
            <span className="font-semibold text-brand-red dark:text-red-400">Fonddan alış</span>
            <span className="num text-brand-red dark:text-red-400">{price2(ask)}</span>
            <span className="text-black/45 dark:text-white/50">· {formatUnits(status.fund_sell_capacity)}</span>
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-black/[0.04] px-2.5 py-1 text-black/45 dark:text-white/50">
            Fond hazırda satmır
          </span>
        )}
      </div>

      {/* Histogram: fund + participant orders by price (bars are clickable) */}
      <div className="flex flex-col gap-1">
        <div className="relative h-44">
          {/* current price marker */}
          <div
            className="absolute bottom-0 top-0 w-px -translate-x-1/2 bg-black/40 dark:bg-white/40"
            style={{ left: `${pos(current)}%` }}
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
                b.fund
                  ? `${b.side === "buy" ? "Fonda satış" : "Fonddan alış"} ${price2(b.price)}`
                  : `${price2(b.price)} — ${formatUnits(b.units ?? 0)} pay, ${b.orders.length} sifariş`
              }
              className="group absolute bottom-0 w-4 -translate-x-1/2 cursor-pointer rounded-t shadow-sm transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/40"
              style={{
                left: `${pos(b.price)}%`,
                height: `${heightPct(b)}%`,
                minHeight: "6px",
                background: barBackground(b.side, b.fund),
              }}
            >
              <span className="num pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] text-black/55 dark:text-white/60">
                {topLabel(b)}
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
        Zolaqlı sütunlar Fondun daimi qiymətləridir, dolu sütunlar isə digər iştirakçıların
        sifarişləri — ətraflı üçün üzərinə klikləyin.
        {participants.length === 0 && " Hələ iştirakçı sifarişi yoxdur."}
      </p>

      {selected && <OrderPopup bar={selected} status={status} onClose={() => setSelected(null)} />}
    </div>
  );
}

function OrderPopup({
  bar,
  status,
  onClose,
}: {
  bar: Bar;
  status: MarketStatus;
  onClose: () => void;
}) {
  const isBuy = bar.side === "buy";
  const color = isBuy ? "text-brand-green dark:text-emerald-400" : "text-brand-red dark:text-red-400";

  let title: string;
  let meta: ReactNode;
  let body: ReactNode = null;

  if (bar.fund) {
    title = isBuy ? "Fonda satış" : "Fonddan alış";
    meta = <>Fond · {bar.units == null ? "limitsiz" : `${formatUnits(bar.units)} pay`}</>;
    body = (
      <p className="mt-3 border-t border-black/10 dark:border-white/15 pt-3 text-xs leading-relaxed text-black/55 dark:text-white/60">
        {isBuy
          ? "Fond payları bu qiymətə həmişə geri alır — istənilən vaxt limitsiz sata bilərsiniz."
          : `Fond bu qiymətə ${formatUnits(status.fund_sell_capacity)} paya qədər satır.`}
      </p>
    );
  } else {
    title = isBuy ? "Alış sifarişi" : "Satış sifarişi";
    meta = (
      <>
        Cəmi <span className="num text-black/70 dark:text-white/75">{formatUnits(bar.units ?? 0)}</span> pay ·{" "}
        {bar.orders.length} sifariş
      </>
    );
    const orders = [...bar.orders].sort((a, b) => b.units - a.units);
    body = (
      <div className="mt-4 flex flex-col gap-1.5 border-t border-black/10 dark:border-white/15 pt-3">
        {orders.map((o, i) => (
          <div key={i} className="flex items-center justify-between gap-3 text-xs">
            <span className="truncate text-black/70 dark:text-white/75">{o.holderName || "Naməlum"}</span>
            <span className="num shrink-0 text-black/45 dark:text-white/50">{formatUnits(o.units)} pay</span>
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
        className="glass-strong relative w-full max-w-[260px] rounded-2xl p-5"
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
