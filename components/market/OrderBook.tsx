import type { ReactNode } from "react";
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
  // Sell orders (you buy from these) — best/lowest sits nearest the current price.
  const asks = book.filter((b) => b.side === "sell").sort((a, b) => b.price - a.price);
  // Buy orders (you sell to these) — best/highest sits nearest the current price.
  const bids = book.filter((b) => b.side === "buy").sort((a, b) => b.price - a.price);
  const fundSellActive = status.fund_sell_capacity > 0;

  return (
    <div className="glass flex flex-col gap-5 p-6">
      <div className="text-[10px] uppercase tracking-[0.22em] text-brand-green/80">
        Bazar dərinliyi
      </div>

      {/* Sell orders — the participant buys from these */}
      <Section title="Satış sifarişləri" hint="almaq üçün" titleColor="text-brand-red">
        {fundSellActive && (
          <Row price={status.alis} qty={formatUnits(status.fund_sell_capacity)} tone="red" fund />
        )}
        {asks.map((b, i) => (
          <Row key={`a${i}`} price={b.price} qty={formatUnits(b.units)} tone="red" name={b.holderName} />
        ))}
        {asks.length === 0 && !fundSellActive && <Empty text="Satış sifarişi yoxdur" />}
      </Section>

      {/* Current price */}
      <div className="flex items-baseline justify-between rounded-lg bg-black/[0.03] px-3 py-2">
        <span className="text-[10px] uppercase tracking-[0.22em] text-black/50">
          Hazırki qiymət
        </span>
        <span className="num text-base font-bold text-black">{price2(status.unit_price)}</span>
      </div>

      {/* Buy orders — the participant sells to these */}
      <Section title="Alış sifarişləri" hint="satmaq üçün" titleColor="text-brand-green">
        {bids.map((b, i) => (
          <Row key={`b${i}`} price={b.price} qty={formatUnits(b.units)} tone="green" name={b.holderName} />
        ))}
        <Row price={status.satis} qty="limitsiz" tone="green" fund />
      </Section>

      <p className="text-[10px] leading-relaxed text-black/45">
        Yuxarıdakı qiymətlərə pay <span className="text-brand-red">ala</span>, aşağıdakılara{" "}
        <span className="text-brand-green">sata</span> bilərsiniz. Fond həmişə{" "}
        <span className="num">{price2(status.satis)}</span> qiymətinə geri alır
        {fundSellActive ? (
          <>
            {" "}
            və <span className="num">{price2(status.alis)}</span> qiymətinə satır
          </>
        ) : null}
        .
      </p>
    </div>
  );
}

function Section({
  title,
  hint,
  titleColor,
  children,
}: {
  title: string;
  hint: string;
  titleColor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className={`text-[11px] font-semibold ${titleColor}`}>{title}</span>
        <span className="text-[10px] text-black/40">{hint}</span>
      </div>
      <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.16em] text-black/30">
        <span>Qiymət</span>
        <span>Pay sayı</span>
      </div>
      <div className="flex flex-col gap-1.5 text-sm">{children}</div>
    </div>
  );
}

function Row({
  price,
  qty,
  tone,
  fund,
  name,
}: {
  price: number;
  qty: string;
  tone: "red" | "green";
  fund?: boolean;
  name?: string;
}) {
  const color = tone === "red" ? "text-brand-red" : "text-brand-green";
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-baseline gap-2">
        <span className={`num shrink-0 ${color}`}>{price2(price)}</span>
        {!fund && name ? (
          <span className="truncate text-[11px] text-black/45">{name}</span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {fund && (
          <span className="rounded-full bg-black/[0.06] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.14em] text-black/45">
            Fond
          </span>
        )}
        <span className="num text-black/70">{qty}</span>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="py-1 text-center text-xs text-black/35">{text}</div>;
}
