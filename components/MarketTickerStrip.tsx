import type { ReactNode } from "react";
import { formatGrouped, formatGroupedTrim } from "@/lib/portfolio";
import type { TickerQuote } from "@/lib/marketTicker";

// The Yahoo-Finance-style ticker card under the dashboard greeting: the
// market-status chips on top, then a scrollable strip of benchmark tiles
// with the İRF unit price as the last tile. Prices print with a trailing
// currency sign ("4.437,30$", "26,38₼") — the strip's own compact style.

const fmtPct = (changePct: number) =>
  `${changePct >= 0 ? "+" : "−"}${formatGroupedTrim(Math.abs(changePct) * 100, 2)}%`;

function Tile({
  label,
  price,
  changePct,
}: {
  label: string;
  price: string;
  changePct: number | null;
}) {
  const tone =
    changePct == null
      ? "text-black/45 dark:text-white/50"
      : changePct >= 0
        ? "text-brand-green dark:text-emerald-400"
        : "text-brand-red dark:text-red-400";
  return (
    <div className="min-w-[6.25rem] flex-1 rounded-xl border border-black/10 bg-white/70 px-3 py-2.5 shadow-sm dark:border-white/10 dark:bg-white/10">
      <div className="truncate text-[10px] font-semibold text-black/55 dark:text-white/60">
        {label}
      </div>
      <div className="num mt-1.5 whitespace-nowrap text-[13px] font-semibold text-black/85 dark:text-white/90">
        {price}
      </div>
      <div className={`num mt-0.5 text-[10px] font-semibold ${tone}`}>
        {changePct == null ? "—" : fmtPct(changePct)}
      </div>
    </div>
  );
}

export function MarketTickerStrip({
  quotes,
  irf,
  statusRow,
}: {
  quotes: TickerQuote[];
  /** The fund's own tile: unit price in AZN + its day change. */
  irf: { priceAzn: number; changePct: number | null };
  /** The countdown / extended-hours chips row rendered below the tiles. */
  statusRow?: ReactNode;
}) {
  return (
    // relative z-20: the card's backdrop-filter creates a stacking context,
    // so the chip popovers' z-50 can't escape it on their own — lifting the
    // whole card keeps them above the chart card below (header stays z-40).
    <div className="relative z-20 flex flex-col gap-2.5 rounded-2xl border border-black/10 bg-white/40 p-2.5 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/5 sm:p-3">
      <div className="px-0.5 pt-0.5 text-[12px] uppercase tracking-[0.22em] text-brand-green/80 sm:text-[14px]">
        Əsas indekslər və aktivlər
      </div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {quotes.map((q) => (
          <Tile
            key={q.key}
            label={q.label}
            price={`${formatGrouped(q.price, 2)}$`}
            changePct={q.changePct}
          />
        ))}
        <Tile
          label="İRF Payı"
          price={`${formatGrouped(irf.priceAzn, 2)}₼`}
          changePct={irf.changePct}
        />
      </div>
      {statusRow}
    </div>
  );
}
