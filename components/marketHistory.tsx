"use client";

import { useEffect, useState } from "react";
import { formatGrouped, formatGroupedTrim } from "@/lib/portfolio";
import type { HistoryPoint } from "@/lib/marketTicker";

// Shared by the two market-at-a-glance surfaces of the dashboard: the
// phone's live strip (MarketTickerStrip — tile panels) and the desktop
// Bazar rail card (MarketRailCard — row sparklines + detail view). One
// chart, one history fetch, one set of primers, so the two never drift.

/** Per-instrument ETF info + the viewer's position, keyed by instrument key
 *  (the purchasable ones: S&P 500 / Bitcoin / Qızıl / Gümüş). */
export type TileAsset = {
  symbol: string;
  priceUsd: number | null;
  dayChangePct: number | null;
  /** Viewer's holding in this asset (0 = none). */
  units: number;
  valueAzn: number | null;
};

export const fmtPct = (changePct: number) =>
  `${changePct >= 0 ? "+" : "−"}${formatGroupedTrim(Math.abs(changePct) * 100, 2)}%`;

export const toneOf = (changePct: number | null) =>
  changePct == null
    ? "text-black/45 dark:text-white/50"
    : changePct >= 0
      ? "text-brand-green dark:text-emerald-400"
      : "text-brand-red dark:text-red-400";

// One-breath primers for the asset panels — what the index/asset is and
// which ETF İsmayıl buys to track it.
export const DESCRIPTIONS: Record<string, string> = {
  sp500:
    "ABŞ-ın 500 ən böyük şirkətini əhatə edən fond indeksi — dünya bazarının əsas barometri. SPY bu indeksi izləyən ETF-dir.",
  nasdaq:
    "ABŞ-ın 100 ən böyük qeyri-maliyyə şirkətini — texnologiya nəhənglərini — əhatə edən indeks, böyümə səhmlərinin barometri.",
  btc: "Bitcoin — ən böyük kriptovalyuta. IBIT (iShares Bitcoin Trust) onun qiymətini birbaşa izləyən ETF-dir.",
  gold: "Qızıl — klassik qoruyucu aktiv, inflyasiyaya qarşı sığorta. GLDM fiziki qızılı izləyən ETF-dir.",
  silver:
    "Gümüş — həm qiymətli metal, həm sənaye xammalı. SIVR fiziki gümüşü izləyən ETF-dir.",
  oil: "Brent xam nefti — dünya enerji bazarının əsas qiymət göstəricisi, inflyasiya və qlobal iqtisadi aktivliyin barometri.",
};

// History ranges. Slices anchor to the series' own last date (not the wall
// clock), so server and client render identically.
export const HIST_RANGES = [
  { key: "6m", label: "6 AY", title: "Son 6 ay", days: 182 },
  { key: "1y", label: "1 İL", title: "Son 1 il", days: 365 },
  { key: "5y", label: "5 İL", title: "Son 5 il", days: null },
] as const;
export type HistRangeKey = (typeof HIST_RANGES)[number]["key"];

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
export function sparkPath(
  values: number[],
  w: number,
  h: number,
  pad: number,
): string {
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

// 5-year histories arrive on demand (they'd be ~80KB of page payload for
// all instruments) and stay cached for the browser session once fetched —
// shared by the strip and the rail, so opening S&P on one never refetches
// it for the other. A failed fetch caches [] like the old per-strip state.
const historyCache = new Map<string, HistoryPoint[]>();
const inflight = new Map<string, Promise<void>>();

function loadHistory(key: string): Promise<void> {
  let p = inflight.get(key);
  if (!p) {
    p = fetch(`/api/ticker-history?key=${encodeURIComponent(key)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((h: HistoryPoint[]) => {
        historyCache.set(key, h ?? []);
      })
      .catch(() => {
        historyCache.set(key, []);
      })
      .finally(() => {
        inflight.delete(key);
      });
    inflight.set(key, p);
  }
  return p;
}

/** The 5-year daily closes for an instrument key (`sp500`, `h-nvda`, …);
 *  undefined while loading, [] when the server has none. */
export function useTickerHistory(
  key: string | null,
): HistoryPoint[] | undefined {
  const [, bump] = useState(0);
  useEffect(() => {
    if (key == null || historyCache.has(key)) return;
    let cancelled = false;
    loadHistory(key).then(() => {
      if (!cancelled) bump((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);
  return key != null ? historyCache.get(key) : undefined;
}

/**
 * The range pills (6 AY · 1 İL · 5 İL + the range's % move) over the price
 * line, with the start / low / high closes pinned to their points.
 * `grow`: the plot fills the remaining height of a flex-column parent
 * (desktop detail view) instead of the phone panel's fixed h-16 / sm:h-20.
 */
export function HistoryChart({
  history,
  range,
  onRange,
  gradientId,
  grow = false,
}: {
  history: HistoryPoint[] | undefined;
  range: HistRangeKey;
  onRange: (r: HistRangeKey) => void;
  gradientId: string;
  grow?: boolean;
}) {
  if (history == null) {
    return (
      <div
        className={`mt-3 flex items-center justify-center text-[11px] text-black/40 dark:text-white/45 ${
          grow ? "min-h-[7rem] flex-1" : "h-16 sm:h-20"
        }`}
      >
        Tarixçə yüklənir...
      </div>
    );
  }
  const rangeDef = HIST_RANGES.find((r) => r.key === range) ?? HIST_RANGES[2];
  const sliced = sliceHistory(history, rangeDef.days);
  const hist = sliced.length >= 2 ? sliced : history;
  if (hist.length < 2) return null;
  const values = hist.map((p) => p.c);
  const pctRange =
    values[0] > 0 ? values[values.length - 1] / values[0] - 1 : null;
  const line = sparkPath(values, 100, 30, 2);

  // Start / low / high figures pinned to their points. The SVG stretches
  // (preserveAspectRatio="none"), so text inside it would distort — labels
  // and dots are HTML, positioned by percentage over the same normalization
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
  const fmtPrice = (v: number) => `${formatGrouped(v, v >= 1000 ? 0 : 2)}$`;
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
    <div className={grow ? "mt-2.5 flex flex-1 flex-col" : "mt-2.5"}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <span className="text-[10px] uppercase tracking-[0.14em] text-black/45 dark:text-white/50">
          {rangeDef.title}
        </span>
        <span className="flex items-center gap-1.5">
          {HIST_RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              aria-pressed={range === r.key}
              onClick={() => onRange(r.key)}
              className={`rounded-md border px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.08em] transition ${
                range === r.key
                  ? "border-brand-green/50 bg-brand-green/15 text-brand-green dark:border-emerald-400/50 dark:text-emerald-400"
                  : "border-black/10 text-black/45 hover:border-brand-green/40 dark:border-white/15 dark:text-white/50 dark:hover:border-emerald-400/40"
              }`}
            >
              {r.label}
            </button>
          ))}
          {pctRange != null ? (
            <span
              className={`num ml-1 text-[11px] font-semibold ${toneOf(pctRange)}`}
            >
              {fmtPct(pctRange)}
            </span>
          ) : null}
        </span>
      </div>
      <div
        className={`relative mt-1 ${grow ? "min-h-[7rem] flex-1" : ""} ${toneOf(pctRange)}`}
      >
        <svg
          viewBox="0 0 100 30"
          preserveAspectRatio="none"
          aria-hidden
          className={grow ? "absolute inset-0 h-full w-full" : "h-16 w-full sm:h-20"}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${line} L100 30 L0 30 Z`} fill={`url(#${gradientId})`} />
          <path
            d={line}
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.85"
            vectorEffect={grow ? "non-scaling-stroke" : undefined}
          />
        </svg>
        {marker(0, values[0], yPct(values[0]) < 50 ? "below" : "above", "start")}
        {/* Both extremes label BELOW their point: the high sits at the
            plot's top edge, so an above-label would collide with the range
            buttons; the low's label falls into the natural gap under the
            chart. */}
        {!flat && maxIdx !== 0 ? marker(maxIdx, vMax, "below", "max") : null}
        {!flat && minIdx !== 0 ? marker(minIdx, vMin, "below", "min") : null}
      </div>
    </div>
  );
}

/**
 * A row-sized sparkline (the rail rows): the latest session's intraday
 * closes as a crisp line over a soft glow pass, tinted by the day's
 * direction — the tiles' TileSpark, shrunk to fit beside a price.
 */
export function MiniSpark({
  values,
  changePct,
  className = "h-[18px] w-10",
}: {
  values: number[];
  changePct: number | null;
  className?: string;
}) {
  const line = sparkPath(values, 40, 18, 2.5);
  if (!line) return null;
  return (
    <svg
      viewBox="0 0 40 18"
      preserveAspectRatio="none"
      aria-hidden
      className={`${className} ${
        changePct != null && changePct < 0
          ? "text-brand-red dark:text-red-400"
          : "text-brand-green dark:text-emerald-400"
      }`}
    >
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.3"
        style={{ filter: "blur(1.5px)" }}
      />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
    </svg>
  );
}
