"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { AnimatePresence, m } from "framer-motion";
import { formatAzn, formatGrouped } from "@/lib/portfolio";
import { Masked } from "@/components/Masked";
import { ASSET_ICONS } from "@/components/assetIcons";
import { SectorIcon } from "@/components/SectorIcon";
import { EXTENDED_META } from "@/components/extendedHoursMeta";
import { useLivePricing } from "@/components/LivePricing";
import {
  DESCRIPTIONS,
  HistoryChart,
  fmtPct,
  sparkPath,
  toneOf,
  useTickerHistory,
  type HistRangeKey,
  type TileAsset,
} from "@/components/marketHistory";
import { isUsMarketOpen } from "@/lib/marketHours";
import type { ExtendedMode as ExtendedModeKey } from "@/lib/marketHours";
import type { TickerQuote } from "@/lib/marketTicker";

// The phone's live strip under the dashboard greeting (desktop has the
// Bazar rail card instead). Collapsed, it is one line: the market pulse and
// the quotes gliding slowly past (İsmayıl: "slowly sliding"), with a round
// expand button at its right end. Expanded — İsmayıl's "125" — it is the
// Yahoo-Finance-style tiles card: benchmark tiles + İRF pay + one tile per
// fund holding, gliding the same way, with the market-status chips below
// and "Hamısı →" to the Bazar page. Purchasable tiles (S&P 500 / Bitcoin /
// Qızıl / Gümüş — the ETFs İsmayıl buys on holders' verbal orders) expand a
// detail panel with the ETF's own quote and the viewer's position; a
// floating popover would be clipped by the strip's overflow, hence the
// accordion. The glide pauses while a panel is open. The panel's chart,
// primers and history fetch live in marketHistory.tsx, shared with the
// desktop Bazar rail card.

export type { TileAsset };

// Tiles that expand into the info panel WITHOUT a purchasable ETF behind
// them — description + range chart only, no position or buy-hint sections.
const INFO_TILES: Record<string, { symbol: string }> = {
  nasdaq: { symbol: "NDX" },
};

/**
 * The day's movement as a soft glowing line behind the tile content: a
 * blurred glow pass under a crisp line, with a gradient wash fading toward
 * the tile floor. Colors ride currentColor so the day's direction tints
 * everything at once. Tiny fixed-size layer — no measurable GPU cost.
 */
function TileSpark({
  values,
  changePct,
  gradientId,
}: {
  values: number[];
  changePct: number | null;
  gradientId: string;
}) {
  const line = sparkPath(values, 100, 26, 3);
  if (!line) return null;
  const area = `${line} L100 26 L0 26 Z`;
  return (
    <svg
      viewBox="0 0 100 26"
      preserveAspectRatio="none"
      aria-hidden
      className={`pointer-events-none absolute inset-x-0 bottom-0 h-1/2 w-full ${
        changePct != null && changePct < 0
          ? "text-brand-red dark:text-red-400"
          : "text-brand-green dark:text-emerald-400"
      }`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      {/* Glow pass: same line, wider and blurred, under the crisp stroke. */}
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.35"
        style={{ filter: "blur(2.5px)" }}
      />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.75"
      />
    </svg>
  );
}

function Tile({
  label,
  price,
  changePct,
  icon,
  sessionIcon,
  spark,
  sparkId,
  expandable = false,
  selected = false,
  onClick,
}: {
  label: string;
  price: string;
  changePct: number | null;
  icon?: ReactNode;
  /** Session glyph (moon/sunrise/sunset) beside the % — the figure carries
   *  an extended-hours move. */
  sessionIcon?: ReactNode;
  spark?: number[];
  sparkId: string;
  expandable?: boolean;
  selected?: boolean;
  onClick?: () => void;
}) {
  const inner = (
    <>
      {spark && spark.length > 1 ? (
        <TileSpark
          values={spark}
          changePct={changePct}
          gradientId={`spark-${sparkId}`}
        />
      ) : null}
      <div className="relative flex items-center gap-1.5">
        {icon}
        <span className="truncate text-[10px] font-semibold text-black/55 dark:text-white/60">
          {label}
        </span>
      </div>
      <div className="num tile-figure relative mt-auto whitespace-nowrap text-[13px] font-semibold text-black/85 dark:text-white/90">
        {price}
      </div>
      <div
        className={`num tile-figure relative mt-0.5 flex items-center gap-1 text-[10px] font-semibold ${toneOf(changePct)}`}
      >
        {changePct == null ? "—" : fmtPct(changePct)}
        {sessionIcon}
      </div>
    </>
  );
  // Glossy shell: vertical sheen gradient + a hairline top highlight; the
  // sparkline layer sits behind the relatively-positioned content above.
  // aspect-square: Yahoo-card proportions — label pinned top, figures
  // bottom (mt-auto), the sparkline filling the lower half behind them.
  // A fixed width (the old min-w) now that the row glides instead of
  // flexing to the viewport.
  const base =
    "relative flex aspect-square w-[6.25rem] shrink-0 flex-col overflow-hidden rounded-xl border px-3 py-2.5 shadow-sm bg-gradient-to-b from-white/80 via-white/60 to-white/50 dark:from-white/10 dark:via-white/[0.05] dark:to-white/[0.03] [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.22),0_1px_2px_0_rgba(0,0,0,0.05)]";
  if (!expandable) {
    return (
      <div className={`${base} border-black/10 dark:border-white/10`}>
        {inner}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={selected}
      className={`${base} text-left transition ${
        selected
          ? "border-brand-green/60 ring-1 ring-inset ring-brand-green/30 dark:border-emerald-400/60"
          : "border-black/10 hover:border-brand-green/40 dark:border-white/10 dark:hover:border-emerald-400/40"
      }`}
    >
      {inner}
    </button>
  );
}

// The collapsed strip's market pulse: a dot and Açıq / Bağlı, computed on
// the client after mount (the wall clock is not hydration-safe).
function MarketPulse() {
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => {
    const tick = () => setOpen(isUsMarketOpen(new Date()));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  if (open == null) {
    return (
      <span
        aria-hidden
        className="h-2 w-2 shrink-0 rounded-full bg-black/10 dark:bg-white/15"
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
      title="ABŞ fond bazarları"
    >
      <span
        className={`h-2 w-2 rounded-full ${
          open ? "bg-brand-green animate-pulse" : "bg-black/25 dark:bg-white/30"
        }`}
      />
      <span
        className={
          open
            ? "text-brand-green dark:text-emerald-400"
            : "text-black/45 dark:text-white/50"
        }
      >
        {open ? "Açıq" : "Bağlı"}
      </span>
    </span>
  );
}

function Chevron({ up = false }: { up?: boolean }) {
  return (
    <svg
      aria-hidden
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={up ? "rotate-180" : ""}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

const ROUND_BTN =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white/80 text-black/55 shadow-sm transition hover:text-black/85 dark:border-white/15 dark:bg-white/10 dark:text-white/65 dark:hover:text-white/90";

export function MarketTickerStrip({
  quotes,
  irf,
  statusRow,
  assets,
  showBuyHint = true,
  holdingQuotes,
}: {
  quotes: TickerQuote[];
  /** The fund's own tile: unit price in AZN + its day change + price history
   *  sparkline, plus the extended session folded into the price, if any.
   *  `live` subscribes the tile to the 3-5s ticker: price = base +
   *  delta/totalUnits, day % re-derived against the same reference. */
  irf: {
    priceAzn: number;
    changePct: number | null;
    spark?: number[];
    sessionMode?: ExtendedModeKey | null;
    live?: {
      basePriceAzn: number;
      prevCloseAzn: number | null;
      totalUnits: number;
    };
  };
  /** The countdown / extended-hours chips row rendered below the tiles. */
  statusRow?: ReactNode;
  /** Purchasable-ETF info per instrument key; tiles without one stay static. */
  assets?: Record<string, TileAsset>;
  /** false for İsmayıl — he is the counterparty, not a buyer. */
  showBuyHint?: boolean;
  /** One tile per fund holding (`h-<ticker>` keys), gliding in the same row
   *  after the benchmarks. Expanding one shows the 5-year history panel. */
  holdingQuotes?: TickerQuote[];
}) {
  // Collapsed one-liner by default; the expand button opens the tiles card.
  const [expanded, setExpanded] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [histRange, setHistRange] = useState<HistRangeKey>("5y");
  // The İRF tile reticks with the live poll; the server-passed figures are
  // the fallback (and the exact hydration match, since the provider's
  // initial state carries the same render-time delta).
  const liveCtx = useLivePricing();
  let irfPriceAzn = irf.priceAzn;
  let irfChangePct = irf.changePct;
  let irfSessionMode = irf.sessionMode ?? null;
  if (irf.live && liveCtx && irf.live.totalUnits > 0) {
    irfPriceAzn = irf.live.basePriceAzn + liveCtx.deltaAzn / irf.live.totalUnits;
    irfChangePct =
      irf.live.prevCloseAzn != null && irf.live.prevCloseAzn > 0
        ? irfPriceAzn / irf.live.prevCloseAzn - 1
        : irf.changePct;
    irfSessionMode = liveCtx.mode;
  }
  // 5-year history, fetched on first expand and cached for the session.
  const openHistory = useTickerHistory(openKey);
  const open = openKey != null ? assets?.[openKey] : undefined;
  const openInfo = openKey != null ? INFO_TILES[openKey] : undefined;
  const openQuote =
    quotes.find((q) => q.key === openKey) ??
    holdingQuotes?.find((q) => q.key === openKey);
  // Holding tiles title the panel with the company name; the ticker takes
  // the symbol slot beside it.
  const openIsHolding = openKey?.startsWith("h-") ?? false;
  const openLabel = (openIsHolding ? openQuote?.name : null) ?? openQuote?.label ?? "";
  // Info tiles fall back to the tile quote itself for the panel header.
  const panelSymbol =
    open?.symbol ??
    openInfo?.symbol ??
    (openIsHolding ? (openQuote?.label ?? "") : "");
  const panelPriceUsd = open?.priceUsd ?? openQuote?.price ?? null;
  const panelDayPct = open?.dayChangePct ?? openQuote?.changePct ?? null;
  const showPanel =
    open != null || openInfo != null || (openIsHolding && openQuote != null);

  const sessionGlyph = (mode: ExtendedModeKey | null | undefined, title?: string) =>
    mode ? (
      <span
        className={`inline-flex shrink-0 ${EXTENDED_META[mode].iconTint}`}
        title={title ?? EXTENDED_META[mode].label}
      >
        {EXTENDED_META[mode].icon}
      </span>
    ) : undefined;

  // ---- the collapsed line's items: İRF first, then the benchmarks
  const lineItems: { key: string; label: string; price: string; changePct: number | null }[] = [
    {
      key: "irf",
      label: "İRF",
      price: `${formatGrouped(irfPriceAzn, 2)}₼`,
      changePct: irfChangePct,
    },
    ...quotes.map((q) => ({
      key: q.key,
      label: q.label,
      price: `${formatGrouped(q.price, 2)}$`,
      changePct: q.changePct,
    })),
  ];
  const lineCopy = (copy: string) =>
    lineItems.map((it) => (
      <span
        key={`${copy}-${it.key}`}
        className="flex items-center gap-1.5 whitespace-nowrap pr-5 text-[11px]"
      >
        <span className="font-semibold text-black/60 dark:text-white/65">
          {it.label}
        </span>
        <span className="num text-black/85 dark:text-white/90">{it.price}</span>
        <span className={`num font-semibold ${toneOf(it.changePct)}`}>
          {it.changePct == null ? "—" : fmtPct(it.changePct)}
        </span>
      </span>
    ));

  // ---- the expanded card's tiles, rendered twice for the seamless glide
  const tilesCopy = (copy: string) => (
    <>
      {quotes.map((q) => (
        <Tile
          key={`${copy}-${q.key}`}
          label={q.label}
          price={`${formatGrouped(q.price, 2)}$`}
          changePct={q.changePct}
          icon={ASSET_ICONS[q.key]}
          sessionIcon={sessionGlyph(
            q.sessionMode,
            q.sessionMode
              ? `${EXTENDED_META[q.sessionMode].label} — ETF proksisi ilə`
              : undefined,
          )}
          spark={q.spark}
          sparkId={`${q.key}-${copy}`}
          expandable={assets?.[q.key] != null || INFO_TILES[q.key] != null}
          selected={openKey === q.key}
          onClick={() => setOpenKey((k) => (k === q.key ? null : q.key))}
        />
      ))}
      <Tile
        key={`${copy}-irf`}
        label="İRF Payı"
        price={`${formatGrouped(irfPriceAzn, 2)}₼`}
        changePct={irfChangePct}
        icon={ASSET_ICONS.irf}
        sessionIcon={sessionGlyph(irfSessionMode)}
        spark={irf.spark}
        sparkId={`irf-${copy}`}
      />
      {/* The fund's own book, one tile per holding, flowing in the SAME
          row after the İRF tile — İsmayıl's call: one continuous strip,
          not a second labeled band. Tapping a tile expands the shared
          history panel below. */}
      {holdingQuotes?.map((q) => (
        <Tile
          key={`${copy}-${q.key}`}
          label={q.label}
          price={`${formatGrouped(q.price, 2)}$`}
          changePct={q.changePct}
          icon={
            <span
              aria-hidden
              className="inline-flex shrink-0 text-black/45 dark:text-white/55"
            >
              <SectorIcon sector={q.sector ?? ""} className="h-3.5 w-3.5" />
            </span>
          }
          sessionIcon={sessionGlyph(q.sessionMode)}
          spark={q.spark}
          sparkId={`${q.key}-${copy}`}
          expandable
          selected={openKey === q.key}
          onClick={() => setOpenKey((k) => (k === q.key ? null : q.key))}
        />
      ))}
    </>
  );
  const tileCount = quotes.length + 1 + (holdingQuotes?.length ?? 0);

  return (
    <AnimatePresence initial={false} mode="wait">
      {!expanded ? (
        <m.div
          key="line"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative z-20 flex h-11 items-center gap-2.5 rounded-2xl border border-black/10 bg-white/40 pl-3 pr-1.5 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/5"
        >
          <MarketPulse />
          <div className="strip-wrap relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]">
            <div
              className="strip-marquee"
              style={
                {
                  "--strip-duration": `${Math.max(30, lineItems.length * 6)}s`,
                } as CSSProperties
              }
            >
              <div className="flex">{lineCopy("a")}</div>
              <div className="flex" data-clone aria-hidden>
                {lineCopy("b")}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-expanded={false}
            aria-label="Bazar panelini aç"
            className={ROUND_BTN}
          >
            <Chevron />
          </button>
        </m.div>
      ) : (
        <m.div
          key="card"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          // relative z-20: the card's backdrop-filter creates a stacking
          // context, so the chip popovers' z-50 can't escape it on their
          // own — lifting the whole card keeps them above the cards below.
          className="relative z-20 flex flex-col gap-2.5 rounded-2xl border border-black/10 bg-white/40 p-2.5 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/5 sm:p-3"
        >
          <div className="flex items-center justify-between gap-2 px-0.5 pt-0.5">
            <span className="text-[11px] uppercase tracking-[0.16em] text-brand-green/80 sm:text-[14px] sm:tracking-[0.22em]">
              Bazar
            </span>
            <span className="flex items-center gap-2">
              <Link
                href="/market"
                className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-green transition hover:text-brand-green-deep dark:text-emerald-400"
              >
                Hamısı →
              </Link>
              <button
                type="button"
                onClick={() => {
                  setExpanded(false);
                  setOpenKey(null);
                }}
                aria-expanded
                aria-label="Bazar panelini yığ"
                className={ROUND_BTN}
              >
                <Chevron up />
              </button>
            </span>
          </div>
          {/* The tiles glide left; an open panel holds them still. */}
          <div
            className="strip-wrap relative overflow-hidden"
            data-paused={openKey != null ? "true" : "false"}
          >
            <div
              className="strip-marquee"
              style={
                { "--strip-duration": `${Math.max(40, tileCount * 4)}s` } as CSSProperties
              }
            >
              <div className="flex gap-2 pr-2">{tilesCopy("a")}</div>
              <div className="flex gap-2 pr-2" data-clone>
                {tilesCopy("b")}
              </div>
            </div>
          </div>
          {/* Unfold animation; mode="wait" + key means switching tiles
              collapses the old panel before the next one slides open. */}
          <AnimatePresence initial={false} mode="wait">
          {showPanel && (
            <m.div
              key={openKey}
              initial={{ height: 0, opacity: 0, y: -6 }}
              animate={{ height: "auto", opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="overflow-hidden"
            >
            <div className="rounded-xl border border-brand-green/30 bg-brand-green/5 px-3.5 py-3 text-[12px]">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="font-semibold text-black/85 dark:text-white/90">
                  {openLabel} ·{" "}
                  <span className="num text-black/55 dark:text-white/60">
                    {panelSymbol}
                  </span>
                </span>
                <span className="num font-semibold text-black/85 dark:text-white/90">
                  {panelPriceUsd != null
                    ? `${formatGrouped(panelPriceUsd, 2)}$`
                    : "—"}
                  {panelDayPct != null ? (
                    <span className={`ml-1.5 ${toneOf(panelDayPct)}`}>
                      {fmtPct(panelDayPct)}
                    </span>
                  ) : null}
                </span>
              </div>

              {/* 1. What this asset is. */}
              {openKey != null && DESCRIPTIONS[openKey] ? (
                <p className="mt-1.5 text-[11px] leading-relaxed text-black/55 dark:text-white/60">
                  {DESCRIPTIONS[openKey]}
                </p>
              ) : null}

              {/* 2. Price history with 6 AY / 1 İL / 5 İL ranges — fetched on
                  first expand. */}
              <HistoryChart
                history={openHistory}
                range={histRange}
                onRange={setHistRange}
                gradientId={`hist-${openKey}`}
              />

              {/* 3. Your position — purchasable tiles only. Positions read as
                  money, not fractional unit counts — İsmayıl's call for the
                  whole personal-assets surface. */}
              {open ? (
                <div className="mt-2.5 text-black/55 dark:text-white/60">
                  {open.units > 0 ? (
                    <>
                      Sizin mövqeyiniz:{" "}
                      {open.valueAzn != null ? (
                        <span className="num font-medium text-black/70 dark:text-white/75">
                          <Masked mask="••••">{formatAzn(open.valueAzn)}</Masked>
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
              {showBuyHint && open && (
                <div className="mt-1 text-[11px] leading-relaxed text-black/45 dark:text-white/50">
                  {open.symbol} almaq və ya satmaq üçün İsmayıl ilə əlaqə saxlayın
                  — sifarişlər şifahi qəbul olunur, aktivlər İRF paylarından ayrı
                  saxlanılır.
                </div>
              )}
            </div>
            </m.div>
          )}
          </AnimatePresence>
          {statusRow}
        </m.div>
      )}
    </AnimatePresence>
  );
}
