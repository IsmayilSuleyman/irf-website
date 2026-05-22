"use client";

import { useEffect, useState } from "react";
import { formatUnits } from "@/lib/portfolio";
import type { BookLevel, MarketStatus } from "@/lib/market";

const price2 = (n: number) => `${n.toFixed(2)} ₼`;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const GREEN = "#16a34a";
const RED = "#dc2626";

type Order = { units: number; holderName: string };
type Level = { price: number; units: number; side: "buy" | "sell"; orders: Order[] };

function aggregate(levels: BookLevel[], side: "buy" | "sell"): Level[] {
  const m = new Map<number, Level>();
  for (const l of levels) {
    const e = m.get(l.price) ?? { price: l.price, units: 0, side, orders: [] };
    e.units += l.units;
    e.orders.push({ units: l.units, holderName: l.holderName });
    m.set(l.price, e);
  }
  return [...m.values()];
}

export function OrderBook({
  book,
  status,
}: {
  book: BookLevel[];
  status: MarketStatus;
}) {
  const [selected, setSelected] = useState<Level | null>(null);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const levels = [
    ...aggregate(book.filter((b) => b.side === "buy"), "buy"),
    ...aggregate(book.filter((b) => b.side === "sell"), "sell"),
  ].sort((a, b) => a.price - b.price);

  const fundSellActive = status.fund_sell_capacity > 0;
  const bid = status.satis; // fund buyback — you sell to the fund here
  const ask = fundSellActive ? status.alis : null; // fund offer — you buy from the fund here
  const current = status.unit_price;

  // Price axis spans the fund quotes, current price and every participant order.
  const prices = [bid, current, ...(ask != null ? [ask] : []), ...levels.map((l) => l.price)];
  let lo = Math.min(...prices);
  let hi = Math.max(...prices);
  if (hi <= lo) {
    hi = lo + 1;
    lo = Math.max(0, lo - 1);
  }
  const pad = (hi - lo) * 0.12;
  const domLo = lo - pad;
  const domHi = hi + pad;
  const span = domHi - domLo;
  const pos = (p: number) => clamp(((p - domLo) / span) * 100, 0, 100);

  const maxUnits = Math.max(1, ...levels.map((l) => l.units));
  const ticks = Array.from({ length: 5 }, (_, i) => domLo + (span * (i + 0.5)) / 5);

  return (
    <div className="glass flex flex-col gap-5 p-6">
      <div className="text-[10px] uppercase tracking-[0.22em] text-brand-green/80">
        Sifarişlər Kitabçası
      </div>

      {/* Fund quotes + current price (also the legend for the dashed lines) */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-green/10 px-2.5 py-1">
          <span className="font-semibold text-brand-green">Fonda satış</span>
          <span className="num text-brand-green">{price2(bid)}</span>
          <span className="text-black/40">· limitsiz</span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] px-2.5 py-1">
          <span className="text-[9px] uppercase tracking-[0.14em] text-black/45">Hazırki</span>
          <span className="num font-semibold text-black">{price2(current)}</span>
        </span>
        {ask != null ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-red/10 px-2.5 py-1">
            <span className="font-semibold text-brand-red">Fonddan alış</span>
            <span className="num text-brand-red">{price2(ask)}</span>
            <span className="text-black/40">· {formatUnits(status.fund_sell_capacity)}</span>
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-black/[0.04] px-2.5 py-1 text-black/35">
            Fond hazırda satmır
          </span>
        )}
      </div>

      {/* Participant orders: volume-at-price histogram (bars are clickable) */}
      {levels.length > 0 ? (
        <div className="flex flex-col gap-1">
          <div className="relative h-44">
            {/* fund / current reference lines */}
            <RefLine left={pos(bid)} tone="green" />
            <RefLine left={pos(current)} tone="dark" />
            {ask != null && <RefLine left={pos(ask)} tone="red" />}
            {/* baseline */}
            <div className="absolute inset-x-0 bottom-0 h-px bg-black/15" />
            {/* bars */}
            {levels.map((l, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSelected(l)}
                aria-label={`${price2(l.price)} — ${formatUnits(l.units)} pay, ${l.orders.length} sifariş`}
                className="group absolute bottom-0 w-4 -translate-x-1/2 cursor-pointer rounded-t shadow-sm transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/40"
                style={{
                  left: `${pos(l.price)}%`,
                  height: `${(l.units / maxUnits) * 100}%`,
                  minHeight: "6px",
                  background: l.side === "buy" ? GREEN : RED,
                }}
              >
                <span className="num pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] text-black/55">
                  {formatUnits(l.units)}
                </span>
              </button>
            ))}
          </div>
          {/* price axis */}
          <div className="relative h-4">
            {ticks.map((t, i) => (
              <span
                key={i}
                className="num absolute -translate-x-1/2 text-[9px] text-black/40"
                style={{ left: `${pos(t)}%` }}
              >
                {t.toFixed(2)}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="py-8 text-center text-xs text-black/35">Hələ iştirakçı sifarişi yoxdur</div>
      )}

      <p className="text-[10px] leading-relaxed text-black/45">
        Fond həmişə <span className="num text-brand-green">{price2(status.satis)}</span> qiymətinə
        geri alır
        {fundSellActive ? (
          <>
            {" "}
            və <span className="num text-brand-red">{price2(status.alis)}</span> qiymətinə satır
          </>
        ) : null}
        .
        {levels.length > 0 && " Sütunlar digər iştirakçıların sifarişləridir (ətraflı üçün üzərinə klikləyin)."}
      </p>

      {selected && <OrderPopup level={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function OrderPopup({ level, onClose }: { level: Level; onClose: () => void }) {
  const isBuy = level.side === "buy";
  const color = isBuy ? "text-brand-green" : "text-brand-red";
  const orders = [...level.orders].sort((a, b) => b.units - a.units);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="glass-strong relative w-full max-w-[260px] rounded-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Bağla"
          className="absolute right-3 top-3 text-black/40 transition hover:text-black/70"
        >
          ✕
        </button>

        <div className={`text-[11px] font-semibold ${color}`}>
          {isBuy ? "Alış sifarişi" : "Satış sifarişi"}
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className={`num text-2xl font-bold ${color}`}>{price2(level.price)}</span>
        </div>
        <div className="mt-1 text-[11px] text-black/50">
          Cəmi <span className="num text-black/70">{formatUnits(level.units)}</span> pay ·{" "}
          {level.orders.length} sifariş
        </div>

        <div className="mt-4 flex flex-col gap-1.5 border-t border-black/10 pt-3">
          {orders.map((o, i) => (
            <div key={i} className="flex items-center justify-between gap-3 text-xs">
              <span className="truncate text-black/70">{o.holderName || "Naməlum"}</span>
              <span className="num shrink-0 text-black/50">{formatUnits(o.units)} pay</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RefLine({ left, tone }: { left: number; tone: "green" | "red" | "dark" }) {
  const color = tone === "green" ? GREEN : tone === "red" ? RED : "rgba(0,0,0,0.5)";
  return (
    <div
      className="absolute bottom-0 top-0 w-px -translate-x-1/2"
      style={{
        left: `${left}%`,
        backgroundImage:
          tone === "dark"
            ? `linear-gradient(${color}, ${color})`
            : `repeating-linear-gradient(${color} 0 4px, transparent 4px 7px)`,
        opacity: tone === "dark" ? 0.55 : 0.7,
      }}
    />
  );
}
