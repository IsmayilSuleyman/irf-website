import { formatUnits } from "@/lib/portfolio";
import type { BookLevel, MarketStatus } from "@/lib/market";

const price2 = (n: number) => `${n.toFixed(2)} ₼`;

export function OrderBook({
  book,
  status,
}: {
  book: BookLevel[];
  status: MarketStatus;
}) {
  // Asks (sells) high → low so the best (lowest) ask sits next to the mid.
  const asks = book.filter((b) => b.side === "sell").sort((a, b) => b.price - a.price);
  // Bids (buys) high → low so the best (highest) bid sits next to the mid.
  const bids = book.filter((b) => b.side === "buy").sort((a, b) => b.price - a.price);
  const fundSellActive = status.fund_sell_capacity > 0;

  return (
    <div className="glass flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.22em] text-brand-green/80">
          Bazar dərinliyi
        </div>
        <div className="text-[10px] text-black/40">
          İştirakçı payı: {(status.public_float_pct * 100).toFixed(1)}% / {(status.float_cap_pct * 100).toFixed(0)}%
        </div>
      </div>

      <div className="flex flex-col gap-1 text-sm">
        {/* Fund standing ask at Alış */}
        <Row
          label="Fond (Alış)"
          price={status.alis}
          units={fundSellActive ? formatUnits(status.fund_sell_capacity) : "—"}
          tone="red"
          muted={!fundSellActive}
        />
        {asks.length === 0 ? (
          <Empty text="Satış sifarişi yoxdur" />
        ) : (
          asks.map((b, i) => (
            <Row key={`a${i}`} price={b.price} units={formatUnits(b.units)} tone="red" />
          ))
        )}

        <div className="my-2 flex items-baseline justify-between border-y border-[rgba(22,163,74,0.18)] py-2">
          <span className="text-[10px] uppercase tracking-[0.22em] text-black/45">Hazırki</span>
          <span className="num font-bold text-black">{price2(status.unit_price)}</span>
        </div>

        {bids.length === 0 ? (
          <Empty text="Alış sifarişi yoxdur" />
        ) : (
          bids.map((b, i) => (
            <Row key={`b${i}`} price={b.price} units={formatUnits(b.units)} tone="green" />
          ))
        )}
        {/* Fund standing bid at Satış (always available) */}
        <Row label="Fond (Satış)" price={status.satis} units="∞" tone="green" />
      </div>
    </div>
  );
}

function Row({
  label,
  price,
  units,
  tone,
  muted,
}: {
  label?: string;
  price: number;
  units: string;
  tone: "red" | "green";
  muted?: boolean;
}) {
  const color = muted ? "text-black/35" : tone === "red" ? "text-brand-red" : "text-brand-green";
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className={`num ${color}`}>{price2(price)}</span>
      <span className="flex items-center gap-2 text-black/55">
        {label && <span className="text-[10px] uppercase tracking-[0.16em] text-black/35">{label}</span>}
        <span className="num">{units}</span>
      </span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="py-1 text-center text-xs text-black/35">{text}</div>;
}
