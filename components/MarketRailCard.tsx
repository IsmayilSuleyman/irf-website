"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, m } from "framer-motion";
import { formatAzn, formatGrouped } from "@/lib/portfolio";
import { Masked } from "@/components/Masked";
import { ASSET_ICONS } from "@/components/assetIcons";
import { SectorIcon } from "@/components/SectorIcon";
import { useLivePricing } from "@/components/LivePricing";
import {
  DESCRIPTIONS,
  HistoryChart,
  MiniSpark,
  fmtPct,
  toneOf,
  useTickerHistory,
  type HistRangeKey,
  type TileAsset,
} from "@/components/marketHistory";
import type { TickerQuote } from "@/lib/marketTicker";

// The desktop dashboard's "Bazar" rail card — the market at a glance beside
// the personal statement: the status chip, one row per benchmark (İRF pay
// first) with the session's sparkline, then the fund's holdings as compact
// chips, the first five shown and the rest behind "+N daha". On phones the
// live strip under the greeting plays this role, so the card is
// desktop-only (the caller hides it below lg). "Hamısı →" opens the Bazar
// page.
//
// Clicking a benchmark row or a holding chip drills the card into that
// asset (İsmayıl, 2026-11-27: "we used to have graphs and price history for
// these assets" — the old tiles' panels): primer, 6 AY · 1 İL · 5 İL price
// history with start / low / high labelled, and the viewer's position for
// the purchasable ETFs; "← Bazar" (or Esc) returns. A drill-in rather than
// an accordion because the rail is sticky — a panel unfolding under a row
// would push the cards below it off the bottom of the screen. The card
// keeps its list height while drilled in, so the rail never jumps.

const CHIPS_VISIBLE = 5;

// Header symbols for the benchmarks without a purchasable ETF behind them
// (the purchasable ones take theirs from `assets`).
const INDEX_SYMBOLS: Record<string, string> = {
  nasdaq: "NDX",
  oil: "Brent",
};

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

function IconDisc({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/5 dark:bg-white/10"
    >
      {children}
    </span>
  );
}

// One row = five cells on the list's shared column grid (icon · label ·
// sparkline · price · pill), so the sparklines and prices line up from row
// to row whatever each price's width (CSS subgrid).
function Row({
  rowKey,
  icon,
  label,
  price,
  pct,
  spark,
  onOpen,
}: {
  rowKey: string;
  icon: ReactNode;
  label: string;
  price: string;
  pct: number | null;
  spark?: number[];
  onOpen?: () => void;
}) {
  const cells = (
    <>
      <IconDisc>{icon}</IconDisc>
      <span
        className={`truncate pl-0.5 text-[13px] text-black/85 dark:text-white/90 ${
          onOpen
            ? "transition group-hover:text-brand-green dark:group-hover:text-emerald-400"
            : ""
        }`}
      >
        {label}
      </span>
      <span className="flex items-center justify-center">
        {spark && spark.length > 1 ? (
          <MiniSpark values={spark} changePct={pct} />
        ) : null}
      </span>
      <span className="num justify-self-end whitespace-nowrap text-[13px] font-medium text-black/85 dark:text-white/90">
        {price}
      </span>
      <Pill pct={pct} />
    </>
  );
  return (
    <li className="col-span-full grid grid-cols-subgrid">
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          data-open-key={rowKey}
          aria-label={`${label} — qiymət tarixçəsi`}
          className="group col-span-full grid grid-cols-subgrid items-center rounded-lg py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/40"
        >
          {cells}
        </button>
      ) : (
        <div className="col-span-full grid grid-cols-subgrid items-center py-2">
          {cells}
        </div>
      )}
    </li>
  );
}

export function MarketRailCard({
  quotes,
  holdingQuotes,
  irf,
  status,
  assets,
  showBuyHint = true,
}: {
  /** The benchmark quotes (S&P 500, Nasdaq, Bitcoin, Qızıl, Gümüş, Neft). */
  quotes: TickerQuote[];
  /** One quote per fund holding — the chips. */
  holdingQuotes: TickerQuote[];
  /** The fund's own pay: price in AZN + day change, subscribed to the 3-5s
   *  ticker like the strip tile, plus its recent price line for the row
   *  sparkline. Not drillable — the Tarixçə card beside it is its history. */
  irf: {
    priceAzn: number;
    changePct: number | null;
    spark?: number[];
    live?: {
      basePriceAzn: number;
      prevCloseAzn: number | null;
      totalUnits: number;
    };
  };
  /** The market-status chip (MarketCountdown). */
  status?: ReactNode;
  /** Purchasable-ETF info + the viewer's position per instrument key. */
  assets?: Record<string, TileAsset>;
  /** false for İsmayıl — he is the counterparty, not a buyer. */
  showBuyHint?: boolean;
}) {
  const [allChips, setAllChips] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [histRange, setHistRange] = useState<HistRangeKey>("5y");
  // The list's height, captured on drill-in: the detail view keeps it as
  // its minimum so the rail below doesn't jump.
  const [listHeight, setListHeight] = useState<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const lastOpened = useRef<string | null>(null);
  const history = useTickerHistory(openKey);

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

  const openAsset = (key: string) => {
    setListHeight(cardRef.current?.offsetHeight ?? null);
    lastOpened.current = key;
    setOpenKey(key);
  };
  const closeAsset = () => setOpenKey(null);

  // Focus follows the drill: into the back button on open, back onto the
  // row / chip that opened it on return (the list re-mounts, so look it up).
  useEffect(() => {
    if (openKey != null) {
      backRef.current?.focus({ preventScroll: true });
    } else if (lastOpened.current != null) {
      const key = lastOpened.current;
      lastOpened.current = null;
      // After the exit animation hands the list back.
      const id = window.setTimeout(() => {
        cardRef.current
          ?.querySelector<HTMLElement>(`[data-open-key="${CSS.escape(key)}"]`)
          ?.focus({ preventScroll: true });
      }, 200);
      return () => window.clearTimeout(id);
    }
  }, [openKey]);

  const shownChips = allChips
    ? holdingQuotes
    : holdingQuotes.slice(0, CHIPS_VISIBLE);
  const hiddenChips = Math.max(0, holdingQuotes.length - CHIPS_VISIBLE);

  const openQuote =
    openKey != null
      ? (quotes.find((q) => q.key === openKey) ??
        holdingQuotes.find((q) => q.key === openKey))
      : undefined;

  const list = (
    <>
      {status ? (
        <div className="flex flex-wrap items-center gap-2">{status}</div>
      ) : null}

      <ul className="grid grid-cols-[1.5rem_minmax(0,1fr)_2.5rem_auto_auto] gap-x-1.5 divide-y divide-[color:var(--glass-border)]">
        <Row
          rowKey="irf"
          icon={ASSET_ICONS.irf}
          label="İRF Payı"
          price={`${formatGrouped(irfPrice, 2)}₼`}
          pct={irfPct}
          spark={irf.spark}
        />
        {quotes.map((q) => (
          <Row
            key={q.key}
            rowKey={q.key}
            icon={ASSET_ICONS[q.key]}
            label={q.label}
            price={`${formatGrouped(q.price, 2)}$`}
            pct={q.changePct}
            spark={q.spark}
            onOpen={() => openAsset(q.key)}
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
              <button
                key={q.key}
                type="button"
                data-open-key={q.key}
                onClick={() => openAsset(q.key)}
                title={q.name ?? q.label}
                aria-label={`${q.name ?? q.label} — qiymət tarixçəsi`}
                className={`num inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition hover:border-brand-green/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/40 dark:hover:border-emerald-400/60 ${
                  q.changePct == null
                    ? "border-black/10 text-black/55 dark:border-white/15 dark:text-white/60"
                    : q.changePct >= 0
                      ? "border-brand-green/30 text-black/70 dark:border-emerald-400/30 dark:text-white/75"
                      : "border-brand-red/30 text-black/70 dark:border-red-400/30 dark:text-white/75"
                }`}
              >
                {q.label}
                <span className={toneOf(q.changePct)}>
                  {q.changePct == null ? "—" : fmtPct(q.changePct)}
                </span>
              </button>
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
    </>
  );

  let detail: ReactNode = null;
  if (openKey != null && openQuote) {
    const isHolding = openKey.startsWith("h-");
    const asset = assets?.[openKey];
    const title = isHolding ? (openQuote.name ?? openQuote.label) : openQuote.label;
    // Holdings: the ticker beside the company name. Purchasable benchmarks
    // name their ETF on the line under the price instead, so none here.
    const symbol = isHolding
      ? openQuote.label
      : asset
        ? null
        : (INDEX_SYMBOLS[openKey] ?? null);
    const icon = isHolding ? (
      <span className="inline-flex text-black/45 dark:text-white/55">
        <SectorIcon sector={openQuote.sector ?? ""} className="h-3.5 w-3.5" />
      </span>
    ) : (
      ASSET_ICONS[openKey]
    );
    detail = (
      <div className="flex flex-1 flex-col text-[12px]">
        <div className="flex items-center gap-2">
          <IconDisc>{icon}</IconDisc>
          <span className="min-w-0 truncate text-[14px] font-semibold text-black/85 dark:text-white/90">
            {title}
          </span>
          {symbol && symbol !== title ? (
            <span className="num shrink-0 text-[11px] text-black/45 dark:text-white/50">
              {symbol}
            </span>
          ) : null}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="num text-[20px] font-semibold leading-none text-black/85 dark:text-white/90">
            {formatGrouped(openQuote.price, 2)}$
          </span>
          <Pill pct={openQuote.changePct} />
        </div>
        {/* The purchasable benchmarks are bought as ETFs — their own quote
            sits under the index figure (the position below is valued on it). */}
        {asset && !isHolding && asset.priceUsd != null ? (
          <div className="num mt-1.5 text-[11px] text-black/55 dark:text-white/60">
            {asset.symbol}: {formatGrouped(asset.priceUsd, 2)}$
            {asset.dayChangePct != null ? (
              <span className={`ml-1.5 font-semibold ${toneOf(asset.dayChangePct)}`}>
                {fmtPct(asset.dayChangePct)}
              </span>
            ) : null}
          </div>
        ) : null}

        {DESCRIPTIONS[openKey] ? (
          <p className="mt-2.5 text-[11px] leading-relaxed text-black/55 dark:text-white/60">
            {DESCRIPTIONS[openKey]}
          </p>
        ) : null}

        <HistoryChart
          history={history}
          range={histRange}
          onRange={setHistRange}
          gradientId={`rail-hist-${openKey}`}
          grow
        />

        {/* Positions read as money, not fractional unit counts — İsmayıl's
            call for the whole personal-assets surface. */}
        {asset ? (
          <div className="mt-5 text-black/55 dark:text-white/60">
            {asset.units > 0 ? (
              <>
                Sizin mövqeyiniz:{" "}
                {asset.valueAzn != null ? (
                  <span className="num font-medium text-black/70 dark:text-white/75">
                    <Masked mask="••••">{formatAzn(asset.valueAzn)}</Masked>
                  </span>
                ) : (
                  "—"
                )}
              </>
            ) : (
              "Bu aktivdə hələ mövqeyiniz yoxdur."
            )}
          </div>
        ) : null}
        {showBuyHint && asset ? (
          <div className="mt-1 text-[11px] leading-relaxed text-black/45 dark:text-white/50">
            {asset.symbol} almaq və ya satmaq üçün İsmayıl ilə əlaqə saxlayın —
            sifarişlər şifahi qəbul olunur, aktivlər İRF paylarından ayrı
            saxlanılır.
          </div>
        ) : null}
      </div>
    );
  }
  const drilled = detail != null;

  return (
    <div
      ref={cardRef}
      onKeyDown={(e) => {
        if (e.key === "Escape" && drilled) {
          e.stopPropagation();
          closeAsset();
        }
      }}
      style={drilled && listHeight != null ? { minHeight: listHeight } : undefined}
      className="glass flex flex-col gap-4 p-5"
    >
      <div className="flex items-center justify-between gap-3">
        {drilled ? (
          <button
            ref={backRef}
            type="button"
            onClick={closeAsset}
            className="-ml-1 flex items-center gap-1 rounded-md px-1 text-[11px] uppercase tracking-[0.16em] text-brand-green/80 transition hover:text-brand-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/40 sm:text-[14px] sm:tracking-[0.22em] dark:hover:text-emerald-400"
          >
            <span aria-hidden className="tracking-normal">
              ←
            </span>
            Bazar
          </button>
        ) : (
          <span className="text-[11px] uppercase tracking-[0.16em] text-brand-green/80 sm:text-[14px] sm:tracking-[0.22em]">
            Bazar
          </span>
        )}
        <Link
          href="/market"
          className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-green transition hover:text-brand-green-deep dark:text-emerald-400"
        >
          Hamısı →
        </Link>
      </div>

      <AnimatePresence initial={false} mode="wait">
        <m.div
          key={drilled ? `detail-${openKey}` : "list"}
          initial={{ opacity: 0, x: drilled ? 12 : -12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: drilled ? 12 : -12 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          className="flex flex-1 flex-col gap-4"
        >
          {drilled ? detail : list}
        </m.div>
      </AnimatePresence>
    </div>
  );
}
