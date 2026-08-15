import type { ReactNode } from "react";
import { formatGrouped, formatGroupedTrim } from "@/lib/portfolio";
import type { TickerQuote } from "@/lib/marketTicker";

// The Yahoo-Finance-style ticker card under the dashboard greeting: the
// market-status chips on top, then a scrollable strip of benchmark tiles
// with the İRF unit price as the last tile. Prices print with a trailing
// currency sign ("4.437,30$", "26,38₼") — the strip's own compact style.

const fmtPct = (changePct: number) =>
  `${changePct >= 0 ? "+" : "−"}${formatGroupedTrim(Math.abs(changePct) * 100, 2)}%`;

// Tiny per-asset marks in front of the labels — inline SVGs/glyphs only,
// kept to the site's palette (brand green for the market/brand marks, the
// muted gray scale for the rest); shape does the distinguishing. Keyed by
// the instrument keys from lib/marketTicker.
const ICONS: Record<string, ReactNode> = {
  sp500: (
    <svg
      viewBox="0 0 24 24"
      className="h-3 w-3 shrink-0 text-brand-green dark:text-emerald-400"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 17l5-5 4 4 8-8" />
      <path d="M15 8h5v5" />
    </svg>
  ),
  btc: (
    <span
      aria-hidden
      className="shrink-0 text-[11px] font-bold leading-none text-black/55 dark:text-white/60"
    >
      ₿
    </span>
  ),
  gold: (
    <span
      aria-hidden
      className="h-3 w-3 shrink-0 rounded-full bg-black/30 dark:bg-white/40"
    />
  ),
  silver: (
    <span
      aria-hidden
      className="h-3 w-3 shrink-0 rounded-full border-[1.5px] border-black/40 dark:border-white/50"
    />
  ),
  oil: (
    <svg
      viewBox="0 0 24 24"
      className="h-3 w-3 shrink-0 text-black/45 dark:text-white/50"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2.7c3.2 3.9 6 7.4 6 10.8a6 6 0 1 1-12 0c0-3.4 2.8-6.9 6-10.8Z" />
    </svg>
  ),
  irf: (
    <svg
      viewBox="0 0 24 24"
      className="h-3 w-3 shrink-0 text-brand-green dark:text-emerald-400"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2c1.2 3.6 2.4 4.8 6 6-3.6 1.2-4.8 2.4-6 6-1.2-3.6-2.4-4.8-6-6 3.6-1.2 4.8-2.4 6-6Z" />
    </svg>
  ),
};

function Tile({
  label,
  price,
  changePct,
  icon,
}: {
  label: string;
  price: string;
  changePct: number | null;
  icon?: ReactNode;
}) {
  const tone =
    changePct == null
      ? "text-black/45 dark:text-white/50"
      : changePct >= 0
        ? "text-brand-green dark:text-emerald-400"
        : "text-brand-red dark:text-red-400";
  return (
    <div className="min-w-[6.25rem] flex-1 rounded-xl border border-black/10 bg-white/70 px-3 py-2.5 shadow-sm dark:border-white/10 dark:bg-white/10">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="truncate text-[10px] font-semibold text-black/55 dark:text-white/60">
          {label}
        </span>
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
            icon={ICONS[q.key]}
          />
        ))}
        <Tile
          label="İRF Payı"
          price={`${formatGrouped(irf.priceAzn, 2)}₼`}
          changePct={irf.changePct}
          icon={ICONS.irf}
        />
      </div>
      {statusRow}
    </div>
  );
}
