"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, m } from "framer-motion";
import {
  formatAzn,
  formatGrouped,
  formatGroupedTrim,
} from "@/lib/portfolio";
import { Masked } from "@/components/Masked";
import { ASSET_ICONS } from "@/components/assetIcons";
import { EXTENDED_META } from "@/components/extendedHoursMeta";
import { useLivePricing } from "@/components/LivePricing";
import type { ExtendedMode as ExtendedModeKey } from "@/lib/marketHours";
import type { HistoryPoint, TickerQuote } from "@/lib/marketTicker";

// The Yahoo-Finance-style ticker card under the dashboard greeting: the
// "Əsas indekslər və aktivlər" tiles with the market-status chips below.
// Purchasable tiles (S&P 500 / Bitcoin / Qızıl / Gümüş — the ETFs İsmayıl
// buys on holders' verbal orders) expand a detail panel with the ETF's own
// quote and the viewer's position; a floating popover would be clipped by
// the strip's horizontal scroll container, hence the accordion.

/** Per-tile ETF info + the viewer's position, keyed by instrument key. */
export type TileAsset = {
  symbol: string;
  priceUsd: number | null;
  dayChangePct: number | null;
  /** Viewer's holding in this asset (0 = none). */
  units: number;
  valueAzn: number | null;
};

const fmtPct = (changePct: number) =>
  `${changePct >= 0 ? "+" : "−"}${formatGroupedTrim(Math.abs(changePct) * 100, 2)}%`;

// One-breath primers for the tile panels — what the index/asset is and
// which ETF İsmayıl buys to track it.
const DESCRIPTIONS: Record<string, string> = {
  sp500:
    "ABŞ-ın 500 ən böyük şirkətini əhatə edən fond indeksi — dünya bazarının əsas barometri. SPY bu indeksi izləyən ETF-dir.",
  nasdaq:
    "ABŞ-ın 100 ən böyük qeyri-maliyyə şirkətini — texnologiya nəhənglərini — əhatə edən indeks, böyümə səhmlərinin barometri.",
  btc: "Bitcoin — ən böyük kriptovalyuta. IBIT (iShares Bitcoin Trust) onun qiymətini birbaşa izləyən ETF-dir.",
  gold: "Qızıl — klassik qoruyucu aktiv, inflyasiyaya qarşı sığorta. GLDM fiziki qızılı izləyən ETF-dir.",
  silver:
    "Gümüş — həm qiymətli metal, həm sənaye xammalı. SIVR fiziki gümüşü izləyən ETF-dir.",
};

// Tiles that expand into the info panel WITHOUT a purchasable ETF behind
// them — description + range chart only, no position or buy-hint sections.
const INFO_TILES: Record<string, { symbol: string }> = {
  nasdaq: { symbol: "NDX" },
};

const toneOf = (changePct: number | null) =>
  changePct == null
    ? "text-black/45 dark:text-white/50"
    : changePct >= 0
      ? "text-brand-green dark:text-emerald-400"
      : "text-brand-red dark:text-red-400";

// Panel history ranges. Slices anchor to the series' own last date (not the
// wall clock), so server and client render identically.
const HIST_RANGES = [
  { key: "6m", label: "6 AY", title: "Son 6 ay", days: 182 },
  { key: "1y", label: "1 İL", title: "Son 1 il", days: 365 },
  { key: "5y", label: "5 İL", title: "Son 5 il", days: null },
] as const;
type HistRangeKey = (typeof HIST_RANGES)[number]["key"];

function sliceHistory(
  hist: HistoryPoint[],
  days: number | null,
): HistoryPoint[] {
  if (days == null || hist.length === 0) return hist;
  const lastMs = new Date(`${hist[hist.length - 1].t}T00:00:00Z`).getTime();
  if (!Number.isFinite(lastMs)) return hist;
  const cutoff = lastMs - days * 86_400_000;
  return hist.filter(
    (p) => new Date(`${p.t}T00:00:00Z`).getTime() >= cutoff,
  );
}

/** Normalize a series into an SVG path over a w×h box (padded vertically). */
function sparkPath(values: number[], w: number, h: number, pad: number): string {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = w / (values.length - 1);
  return values
    .map(
      (v, i) =>
        `${i === 0 ? "M" : "L"}${(i * step).toFixed(2)} ${(
          h - pad - ((v - min) / span) * (h - pad * 2)
        ).toFixed(2)}`,
    )
    .join(" ");
}

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
  const base =
    "relative flex aspect-square min-w-[6.25rem] flex-1 flex-col overflow-hidden rounded-xl border px-3 py-2.5 shadow-sm bg-gradient-to-b from-white/80 via-white/60 to-white/50 dark:from-white/10 dark:via-white/[0.05] dark:to-white/[0.03] [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.22),0_1px_2px_0_rgba(0,0,0,0.05)]";
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

export function MarketTickerStrip({
  quotes,
  irf,
  statusRow,
  assets,
  showBuyHint = true,
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
}) {
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
  // 5-year histories arrive on demand (they'd be ~80KB of page payload for
  // all six tiles) and stick around for the session once fetched.
  const [histories, setHistories] = useState<Record<string, HistoryPoint[]>>(
    {},
  );
  useEffect(() => {
    if (openKey == null || histories[openKey] != null) return;
    let cancelled = false;
    fetch(`/api/ticker-history?key=${encodeURIComponent(openKey)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((h: HistoryPoint[]) => {
        if (!cancelled) {
          setHistories((prev) => ({ ...prev, [openKey]: h ?? [] }));
        }
      })
      .catch(() => {
        if (!cancelled) setHistories((prev) => ({ ...prev, [openKey]: [] }));
      });
    return () => {
      cancelled = true;
    };
  }, [openKey, histories]);
  const open = openKey != null ? assets?.[openKey] : undefined;
  const openInfo = openKey != null ? INFO_TILES[openKey] : undefined;
  const openQuote = quotes.find((q) => q.key === openKey);
  const openLabel = openQuote?.label ?? "";
  // Info tiles fall back to the tile quote itself for the panel header.
  const panelSymbol = open?.symbol ?? openInfo?.symbol ?? "";
  const panelPriceUsd = open?.priceUsd ?? openQuote?.price ?? null;
  const panelDayPct = open?.dayChangePct ?? openQuote?.changePct ?? null;
  const showPanel = open != null || openInfo != null;

  return (
    // relative z-20: the card's backdrop-filter creates a stacking context,
    // so the chip popovers' z-50 can't escape it on their own — lifting the
    // whole card keeps them above the chart card below (header stays z-40).
    <div className="relative z-20 flex flex-col gap-2.5 rounded-2xl border border-black/10 bg-white/40 p-2.5 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/5 sm:p-3">
      <div className="px-0.5 pt-0.5 text-[11px] uppercase tracking-[0.16em] text-brand-green/80 sm:text-[14px] sm:tracking-[0.22em]">
        Əsas indekslər və aktivlər
      </div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {quotes.map((q) => (
          <Tile
            key={q.key}
            label={q.label}
            price={`${formatGrouped(q.price, 2)}$`}
            changePct={q.changePct}
            icon={ASSET_ICONS[q.key]}
            sessionIcon={
              q.sessionMode ? (
                <span
                  className={`inline-flex shrink-0 ${EXTENDED_META[q.sessionMode].iconTint}`}
                  title={`${EXTENDED_META[q.sessionMode].label} — ETF proksisi ilə`}
                >
                  {EXTENDED_META[q.sessionMode].icon}
                </span>
              ) : undefined
            }
            spark={q.spark}
            sparkId={q.key}
            expandable={assets?.[q.key] != null || INFO_TILES[q.key] != null}
            selected={openKey === q.key}
            onClick={() =>
              setOpenKey((k) => (k === q.key ? null : q.key))
            }
          />
        ))}
        <Tile
          label="İRF Payı"
          price={`${formatGrouped(irfPriceAzn, 2)}₼`}
          changePct={irfChangePct}
          icon={ASSET_ICONS.irf}
          sessionIcon={
            irfSessionMode ? (
              <span
                className={`inline-flex shrink-0 ${EXTENDED_META[irfSessionMode].iconTint}`}
                title={EXTENDED_META[irfSessionMode].label}
              >
                {EXTENDED_META[irfSessionMode].icon}
              </span>
            ) : undefined
          }
          spark={irf.spark}
          sparkId="irf"
        />
      </div>
      {/* Unfold animation; mode="wait" + key means switching tiles collapses
          the old panel before the next one slides open. */}
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
          {(() => {
            const full = openKey != null ? histories[openKey] : undefined;
            if (full == null) {
              return (
                <div className="mt-3 flex h-16 items-center justify-center text-[11px] text-black/40 dark:text-white/45 sm:h-20">
                  Tarixçə yüklənir...
                </div>
              );
            }
            const rangeDef =
              HIST_RANGES.find((r) => r.key === histRange) ?? HIST_RANGES[2];
            const sliced = sliceHistory(full, rangeDef.days);
            const hist = sliced.length >= 2 ? sliced : full;
            if (hist.length < 2) return null;
            const values = hist.map((p) => p.c);
            const pctRange =
              values[0] > 0 ? values[values.length - 1] / values[0] - 1 : null;
            const line = sparkPath(values, 100, 30, 2);
            const gid = `hist-${openKey}`;
            return (
              <div className="mt-2.5">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-black/45 dark:text-white/50">
                    {rangeDef.title}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {HIST_RANGES.map((r) => (
                      <button
                        key={r.key}
                        type="button"
                        aria-pressed={histRange === r.key}
                        onClick={() => setHistRange(r.key)}
                        className={`rounded-md border px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.08em] transition ${
                          histRange === r.key
                            ? "border-brand-green/50 bg-brand-green/15 text-brand-green dark:border-emerald-400/50 dark:text-emerald-400"
                            : "border-black/10 text-black/45 hover:border-brand-green/40 dark:border-white/15 dark:text-white/50 dark:hover:border-emerald-400/40"
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                    {pctRange != null ? (
                      <span className={`num ml-1 text-[11px] font-semibold ${toneOf(pctRange)}`}>
                        {fmtPct(pctRange)}
                      </span>
                    ) : null}
                  </span>
                </div>
                {(() => {
                  // Start / low / high figures pinned to their points. The
                  // SVG stretches (preserveAspectRatio="none"), so text
                  // inside it would distort — labels and dots are HTML,
                  // positioned by percentage over the same normalization
                  // sparkPath uses.
                  const n = values.length;
                  const vMin = Math.min(...values);
                  const vMax = Math.max(...values);
                  const span = vMax - vMin || 1;
                  const minIdx = values.indexOf(vMin);
                  const maxIdx = values.indexOf(vMax);
                  const PAD = 2 / 30;
                  const xPct = (i: number) => (i / (n - 1)) * 100;
                  const yPct = (v: number) =>
                    (PAD + (1 - (v - vMin) / span) * (1 - 2 * PAD)) * 100;
                  const fmtPrice = (v: number) =>
                    `${formatGrouped(v, v >= 1000 ? 0 : 2)}$`;
                  const marker = (
                    i: number,
                    v: number,
                    pos: "above" | "below",
                    key: string,
                  ) => {
                    const x = xPct(i);
                    const y = yPct(v);
                    const tx = x < 10 ? "0%" : x > 90 ? "-100%" : "-50%";
                    const ty = pos === "above" ? "calc(-100% - 4px)" : "4px";
                    return (
                      <span key={key} className="pointer-events-none">
                        <span
                          className="absolute h-1.5 w-1.5 rounded-full bg-current"
                          style={{
                            left: `${x}%`,
                            top: `${y}%`,
                            transform: "translate(-50%, -50%)",
                          }}
                        />
                        <span
                          className="num absolute whitespace-nowrap rounded bg-white/80 px-1 text-[9px] font-semibold leading-4 text-black/65 dark:bg-black/50 dark:text-white/80"
                          style={{
                            left: `${x}%`,
                            top: `${y}%`,
                            transform: `translate(${tx}, ${ty})`,
                          }}
                        >
                          {fmtPrice(v)}
                        </span>
                      </span>
                    );
                  };
                  const flat = minIdx === maxIdx;
                  return (
                    <div className={`relative mt-1 ${toneOf(pctRange)}`}>
                      <svg
                        viewBox="0 0 100 30"
                        preserveAspectRatio="none"
                        aria-hidden
                        className="h-16 w-full sm:h-20"
                      >
                        <defs>
                          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                            <stop
                              offset="0%"
                              stopColor="currentColor"
                              stopOpacity="0.22"
                            />
                            <stop
                              offset="100%"
                              stopColor="currentColor"
                              stopOpacity="0"
                            />
                          </linearGradient>
                        </defs>
                        <path d={`${line} L100 30 L0 30 Z`} fill={`url(#${gid})`} />
                        <path
                          d={line}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          opacity="0.85"
                        />
                      </svg>
                      {marker(
                        0,
                        values[0],
                        yPct(values[0]) < 50 ? "below" : "above",
                        "start",
                      )}
      {/* Both extremes label BELOW their point: the high sits at the
                          plot's top edge, so an above-label would collide
                          with the range buttons; the low's label falls into
                          the natural gap under the chart. */}
                      {!flat && maxIdx !== 0
                        ? marker(maxIdx, vMax, "below", "max")
                        : null}
                      {!flat && minIdx !== 0
                        ? marker(minIdx, vMin, "below", "min")
                        : null}
                    </div>
                  );
                })()}
              </div>
            );
          })()}

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
    </div>
  );
}
