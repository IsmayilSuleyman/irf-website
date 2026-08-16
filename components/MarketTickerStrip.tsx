"use client";

import { useState, type ReactNode } from "react";
import {
  formatAzn,
  formatGrouped,
  formatGroupedTrim,
} from "@/lib/portfolio";
import { Masked } from "@/components/Masked";
import { ASSET_ICONS } from "@/components/assetIcons";
import type { TickerQuote } from "@/lib/marketTicker";

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

const toneOf = (changePct: number | null) =>
  changePct == null
    ? "text-black/45 dark:text-white/50"
    : changePct >= 0
      ? "text-brand-green dark:text-emerald-400"
      : "text-brand-red dark:text-red-400";

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
      className={`pointer-events-none absolute inset-x-0 bottom-0 h-9 w-full ${
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
      <div className="num relative mt-1.5 whitespace-nowrap text-[13px] font-semibold text-black/85 dark:text-white/90">
        {price}
      </div>
      <div
        className={`num relative mt-0.5 text-[10px] font-semibold ${toneOf(changePct)}`}
      >
        {changePct == null ? "—" : fmtPct(changePct)}
      </div>
    </>
  );
  // Glossy shell: vertical sheen gradient + a hairline top highlight; the
  // sparkline layer sits behind the relatively-positioned content above.
  const base =
    "relative min-w-[6.25rem] flex-1 overflow-hidden rounded-xl border px-3 py-2.5 shadow-sm bg-gradient-to-b from-white/90 via-white/65 to-white/50 dark:from-white/15 dark:via-white/[0.07] dark:to-white/[0.03] [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.35),0_1px_2px_0_rgba(0,0,0,0.05)]";
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
  /** The fund's own tile: unit price in AZN + its day change + price history sparkline. */
  irf: { priceAzn: number; changePct: number | null; spark?: number[] };
  /** The countdown / extended-hours chips row rendered below the tiles. */
  statusRow?: ReactNode;
  /** Purchasable-ETF info per instrument key; tiles without one stay static. */
  assets?: Record<string, TileAsset>;
  /** false for İsmayıl — he is the counterparty, not a buyer. */
  showBuyHint?: boolean;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const open = openKey != null ? assets?.[openKey] : undefined;
  const openLabel = quotes.find((q) => q.key === openKey)?.label ?? "";

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
            spark={q.spark}
            sparkId={q.key}
            expandable={assets?.[q.key] != null}
            selected={openKey === q.key}
            onClick={() =>
              setOpenKey((k) => (k === q.key ? null : q.key))
            }
          />
        ))}
        <Tile
          label="İRF Payı"
          price={`${formatGrouped(irf.priceAzn, 2)}₼`}
          changePct={irf.changePct}
          icon={ASSET_ICONS.irf}
          spark={irf.spark}
          sparkId="irf"
        />
      </div>
      {open && (
        <div className="rounded-xl border border-brand-green/30 bg-brand-green/5 px-3.5 py-3 text-[12px]">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="font-semibold text-black/85 dark:text-white/90">
              {openLabel} ·{" "}
              <span className="num text-black/55 dark:text-white/60">
                {open.symbol}
              </span>
            </span>
            <span className="num font-semibold text-black/85 dark:text-white/90">
              {open.priceUsd != null
                ? `${formatGrouped(open.priceUsd, 2)}$`
                : "—"}
              {open.dayChangePct != null ? (
                <span className={`ml-1.5 ${toneOf(open.dayChangePct)}`}>
                  {fmtPct(open.dayChangePct)}
                </span>
              ) : null}
            </span>
          </div>
          {/* Positions read as money, not fractional unit counts — İsmayıl's
              call for the whole personal-assets surface. */}
          <div className="mt-1.5 text-black/55 dark:text-white/60">
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
          {showBuyHint && (
            <div className="mt-1 text-[11px] leading-relaxed text-black/45 dark:text-white/50">
              {open.symbol} almaq və ya satmaq üçün İsmayıl ilə əlaqə saxlayın
              — sifarişlər şifahi qəbul olunur, aktivlər İRF paylarından ayrı
              saxlanılır.
            </div>
          )}
        </div>
      )}
      {statusRow}
    </div>
  );
}
