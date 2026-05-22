import { formatUnits } from "@/lib/portfolio";
import type { BookLevel, MarketStatus } from "@/lib/market";

const price2 = (n: number) => `${n.toFixed(2)} ₼`;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const GREEN = "#16a34a";
const RED = "#dc2626";

type Level = { price: number; units: number; count: number; side: "buy" | "sell" };

function aggregate(levels: BookLevel[], side: "buy" | "sell"): Level[] {
  const m = new Map<number, Level>();
  for (const l of levels) {
    const e = m.get(l.price) ?? { price: l.price, units: 0, count: 0, side };
    e.units += l.units;
    e.count += l.order_count > 0 ? l.order_count : 1;
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
  const levels = [
    ...aggregate(book.filter((b) => b.side === "buy"), "buy"),
    ...aggregate(book.filter((b) => b.side === "sell"), "sell"),
  ].sort((a, b) => a.price - b.price);

  const fundSellActive = status.fund_sell_capacity > 0;
  const bid = status.satis; // fund buyback (green "Alış")
  const ask = fundSellActive ? status.alis : null; // fund offer (red "Satış")
  const current = status.unit_price;

  const spread = ask != null ? ask - bid : null;
  const spreadPct = spread != null && current > 0 ? (spread / current) * 100 : null;

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
          <span className="font-semibold text-brand-green">Alış</span>
          <span className="num text-brand-green">{price2(bid)}</span>
          <span className="text-black/40">· limitsiz</span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] px-2.5 py-1">
          <span className="text-[9px] uppercase tracking-[0.14em] text-black/45">Hazırki</span>
          <span className="num font-semibold text-black">{price2(current)}</span>
        </span>
        {ask != null ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-red/10 px-2.5 py-1">
            <span className="font-semibold text-brand-red">Satış</span>
            <span className="num text-brand-red">{price2(ask)}</span>
            <span className="text-black/40">· {formatUnits(status.fund_sell_capacity)}</span>
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-black/[0.04] px-2.5 py-1 text-black/35">
            Satış — fond satmır
          </span>
        )}
      </div>

      {/* Participant orders: volume-at-price histogram */}
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
              <div
                key={i}
                title={`${l.side === "buy" ? "Alış" : "Satış"} · ${price2(l.price)} · ${formatUnits(l.units)} pay · ${l.count} sifariş`}
                className="group absolute bottom-0 flex -translate-x-1/2 justify-center"
                style={{ left: `${pos(l.price)}%`, height: `${(l.units / maxUnits) * 100}%`, minHeight: "4px" }}
              >
                <div
                  className="w-2.5 rounded-t transition-opacity group-hover:opacity-80"
                  style={{ height: "100%", background: l.side === "buy" ? GREEN : RED }}
                />
                <span className="num pointer-events-none absolute -top-4 text-[9px] text-black/50">
                  {formatUnits(l.units)}
                </span>
              </div>
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

      {spread != null && (
        <div className="text-center text-[11px] text-black/45">
          Fərq{" "}
          <span className="num font-semibold text-black/70">{price2(spread)}</span>
          {spreadPct != null && <> · {spreadPct.toFixed(1)}%</>}
        </div>
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
        {levels.length > 0 && " Sütunlar digər iştirakçıların sifarişləridir."}
      </p>
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
