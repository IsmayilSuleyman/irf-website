"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { formatGrouped, formatGroupedTrim } from "@/lib/portfolio";
import { ASSET_ICONS } from "@/components/assetIcons";
import { useLivePricing } from "@/components/LivePricing";
import type { TickerQuote } from "@/lib/marketTicker";

// The desktop dashboard's "Bazar" rail card — the market at a glance beside
// the personal statement: the status chip, one row per benchmark (İRF pay
// first), then the fund's holdings as compact chips, the first five shown
// and the rest behind "+N daha". On phones the live strip under the
// greeting plays this role, so the card is desktop-only (the caller hides
// it below lg). "Hamısı →" opens the Bazar page.

const CHIPS_VISIBLE = 5;

const fmtPct = (p: number) =>
  `${p >= 0 ? "+" : "−"}${formatGroupedTrim(Math.abs(p) * 100, 2)}%`;

function Pill({ pct }: { pct: number | null }) {
  const cls =
    pct == null
      ? "border-black/10 text-black/45 dark:border-white/15 dark:text-white/50"
      : pct >= 0
        ? "border-brand-green/40 text-brand-green dark:text-emerald-400"
        : "border-brand-red/40 text-brand-red dark:text-red-400";
  return (
    <span
      className={`num inline-flex min-w-[3.6rem] justify-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${cls}`}
    >
      {pct == null ? "—" : fmtPct(pct)}
    </span>
  );
}

function Row({
  icon,
  label,
  price,
  pct,
}: {
  icon: ReactNode;
  label: string;
  price: string;
  pct: number | null;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <span className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/5 dark:bg-white/10"
        >
          {icon}
        </span>
        <span className="truncate text-[13px] text-black/85 dark:text-white/90">
          {label}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="num text-[13px] font-medium text-black/85 dark:text-white/90">
          {price}
        </span>
        <Pill pct={pct} />
      </span>
    </li>
  );
}

export function MarketRailCard({
  quotes,
  holdingQuotes,
  irf,
  status,
}: {
  /** The benchmark quotes (S&P 500, Nasdaq, Bitcoin, Qızıl, Gümüş, Neft). */
  quotes: TickerQuote[];
  /** One quote per fund holding — the chips. */
  holdingQuotes: TickerQuote[];
  /** The fund's own pay: price in AZN + day change, subscribed to the 3-5s
   *  ticker like the strip tile. */
  irf: {
    priceAzn: number;
    changePct: number | null;
    live?: {
      basePriceAzn: number;
      prevCloseAzn: number | null;
      totalUnits: number;
    };
  };
  /** The market-status chip (MarketCountdown). */
  status?: ReactNode;
}) {
  const [allChips, setAllChips] = useState(false);
  const liveCtx = useLivePricing();
  let irfPrice = irf.priceAzn;
  let irfPct = irf.changePct;
  if (irf.live && liveCtx && irf.live.totalUnits > 0) {
    irfPrice = irf.live.basePriceAzn + liveCtx.deltaAzn / irf.live.totalUnits;
    irfPct =
      irf.live.prevCloseAzn != null && irf.live.prevCloseAzn > 0
        ? irfPrice / irf.live.prevCloseAzn - 1
        : irf.changePct;
  }
  const shownChips = allChips
    ? holdingQuotes
    : holdingQuotes.slice(0, CHIPS_VISIBLE);
  const hiddenChips = Math.max(0, holdingQuotes.length - CHIPS_VISIBLE);

  return (
    <div className="glass flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] uppercase tracking-[0.16em] text-brand-green/80 sm:text-[14px] sm:tracking-[0.22em]">
          Bazar
        </span>
        <Link
          href="/market"
          className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-green transition hover:text-brand-green-deep dark:text-emerald-400"
        >
          Hamısı →
        </Link>
      </div>

      {status ? (
        <div className="flex flex-wrap items-center gap-2">{status}</div>
      ) : null}

      <ul className="flex flex-col divide-y divide-[color:var(--glass-border)]">
        <Row
          icon={ASSET_ICONS.irf}
          label="İRF Payı"
          price={`${formatGrouped(irfPrice, 2)}₼`}
          pct={irfPct}
        />
        {quotes.map((q) => (
          <Row
            key={q.key}
            icon={ASSET_ICONS[q.key]}
            label={q.label}
            price={`${formatGrouped(q.price, 2)}$`}
            pct={q.changePct}
          />
        ))}
      </ul>

      {holdingQuotes.length > 0 ? (
        <div className="flex flex-col gap-2 border-t border-[color:var(--glass-border)] pt-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] uppercase tracking-[0.18em] text-black/45 dark:text-white/50">
              Fond mövqeləri
            </span>
            <span className="num text-[10px] text-black/45 dark:text-white/50">
              {holdingQuotes.length} mövqe
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {shownChips.map((q) => (
              <span
                key={q.key}
                title={q.name ?? q.label}
                className={`num inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                  q.changePct == null
                    ? "border-black/10 text-black/55 dark:border-white/15 dark:text-white/60"
                    : q.changePct >= 0
                      ? "border-brand-green/30 text-black/70 dark:border-emerald-400/30 dark:text-white/75"
                      : "border-brand-red/30 text-black/70 dark:border-red-400/30 dark:text-white/75"
                }`}
              >
                {q.label}
                <span
                  className={
                    q.changePct == null
                      ? "text-black/45 dark:text-white/50"
                      : q.changePct >= 0
                        ? "text-brand-green dark:text-emerald-400"
                        : "text-brand-red dark:text-red-400"
                  }
                >
                  {q.changePct == null ? "—" : fmtPct(q.changePct)}
                </span>
              </span>
            ))}
            {hiddenChips > 0 ? (
              <button
                type="button"
                onClick={() => setAllChips((a) => !a)}
                aria-expanded={allChips}
                className="rounded-full border border-brand-green/30 bg-brand-green/5 px-2 py-0.5 text-[10px] font-semibold text-brand-green transition hover:bg-brand-green/10 dark:text-emerald-400"
              >
                {allChips ? "Daha az" : `+${hiddenChips} daha`}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
