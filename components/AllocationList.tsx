"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { formatAzn } from "@/lib/portfolio";
import { EXTENDED_META } from "@/components/extendedHoursMeta";
import type { ExtendedMode, ExtendedSymbolQuote } from "@/lib/extendedPortfolio";

type Item = {
  symbol?: string;
  name: string;
  priceUsd?: number;
  valueAzn: number;
  percent: number;
  changePct?: number | null;
  dayChangePct?: number | null;
  dayChangeAzn?: number | null;
  totalPnlAzn?: number | null;
  isCash?: boolean;
  color?: string;
};

/** Extended-hours quotes keyed by upper-cased holding symbol. */
export type ExtendedListData = {
  mode: ExtendedMode;
  quotes: Record<string, ExtendedSymbolQuote>;
};

type ColumnKey =
  | "value"
  | "price"
  | "totalChange"
  | "dayChange"
  | "percent"
  | "extended";

const COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "value", label: "Ümumi Dəyəri" },
  { key: "price", label: "Hazırki Qiymət" },
  { key: "totalChange", label: "Ümumi Dəyişim" },
  { key: "dayChange", label: "Günlük Dəyişim" },
  { key: "percent", label: "Faizlə Dəyəri" },
];

const usdFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function AnimatedFigure({
  keyName,
  inline = false,
  children,
}: {
  keyName: string;
  inline?: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.span
      key={keyName}
      layout
      initial={{ opacity: 0, y: -4, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.92 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      style={{ display: inline ? "inline-block" : "inline-flex" }}
    >
      {children}
    </motion.span>
  );
}

function formatSignedAzn(v: number): string {
  const sign = v > 0 ? "+" : v < 0 ? "-" : "";
  return `${sign}${formatAzn(Math.abs(v))}`;
}

function ChangeBadge({
  pct,
  amountAzn,
  mode,
  onToggle,
  variant = "filled",
}: {
  pct: number;
  amountAzn?: number | null;
  mode: "pct" | "amount";
  onToggle?: () => void;
  variant?: "filled" | "outlined";
}) {
  const hasAmount = amountAzn != null && Number.isFinite(amountAzn);
  const showAmount = mode === "amount" && hasAmount;
  const ref = showAmount ? (amountAzn as number) : pct;
  const up = ref >= 0;
  const cls =
    variant === "filled"
      ? up
        ? "bg-brand-green/15 text-brand-green dark:text-emerald-400"
        : "bg-brand-red/15 text-brand-red dark:text-red-400"
      : up
        ? "border border-brand-green/40 text-brand-green dark:text-emerald-400"
        : "border border-brand-red/40 text-brand-red dark:text-red-400";
  const label = showAmount
    ? formatSignedAzn(amountAzn as number)
    : `${up ? "+" : ""}${(pct * 100).toFixed(1)}%`;
  const base = `num rounded-md px-1.5 py-0.5 text-[10px] font-medium ${cls}`;
  if (!onToggle || !hasAmount) {
    return <span className={base}>{label}</span>;
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={showAmount}
      className={`${base} cursor-pointer transition hover:brightness-95`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={showAmount ? "amount" : "pct"}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="inline-block whitespace-nowrap"
        >
          {label}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

// Yesterday's value is derived from today's price move, assuming unit counts
// didn't change overnight. A buy/sell that day will show up as a rank shift,
// which is acceptable for the lightweight ranking badge.
function yesterdayValueOf(item: Item): number {
  const dp = item.dayChangePct;
  if (dp == null || !Number.isFinite(dp) || 1 + dp === 0) return item.valueAzn;
  return item.valueAzn / (1 + dp);
}

function RankBadge({ rank, delta }: { rank: number; delta: number }) {
  return (
    <div className="num flex w-7 shrink-0 items-center text-xs text-black/55 dark:text-white/60">
      <span className="w-3 text-right tabular-nums">{rank}</span>
      <span className="flex flex-1 items-center justify-center">
        {delta > 0 ? (
          <svg
            aria-label={`${delta} yer qalxıb`}
            viewBox="0 0 10 10"
            className="h-2.5 w-2.5 fill-brand-green"
          >
            <path d="M5 1.5 L9 8 L1 8 Z" />
          </svg>
        ) : delta < 0 ? (
          <svg
            aria-label={`${-delta} yer düşüb`}
            viewBox="0 0 10 10"
            className="h-2.5 w-2.5 fill-brand-red"
          >
            <path d="M5 8.5 L1 2 L9 2 Z" />
          </svg>
        ) : (
          <span aria-label="dəyişiklik yoxdur" className="h-2.5 w-2.5" />
        )}
      </span>
    </div>
  );
}

export function AllocationList({
  items,
  extended,
}: {
  items: Item[];
  /** Present only while a pre/after-market or overnight window is active. */
  extended?: ExtendedListData | null;
}) {
  const [visible, setVisible] = useState<Record<ColumnKey, boolean>>({
    value: true,
    price: true,
    totalChange: true,
    dayChange: true,
    percent: true,
    extended: true,
  });
  // Per-row mode for the two change badges: "pct" (default) vs "amount" (AZN).
  // Clicking a badge flips just that row's view so you can compare holdings
  // side-by-side in either unit without affecting the others.
  const [dayMode, setDayMode] = useState<Record<string, "pct" | "amount">>({});
  const [totalMode, setTotalMode] = useState<Record<string, "pct" | "amount">>(
    {},
  );

  if (!items || items.length === 0) {
    return <div className="text-black/45 dark:text-white/50">Məlumat yoxdur.</div>;
  }

  const todayRanked = [...items].sort((a, b) => b.valueAzn - a.valueAzn);
  const todayRank = new Map(todayRanked.map((it, i) => [it.name, i + 1]));
  const yesterdayRanked = [...items].sort(
    (a, b) => yesterdayValueOf(b) - yesterdayValueOf(a),
  );
  const yesterdayRank = new Map(
    yesterdayRanked.map((it, i) => [it.name, i + 1]),
  );

  const toggle = (key: ColumnKey) =>
    setVisible((v) => ({ ...v, [key]: !v[key] }));
  const flipMode = (setter: typeof setDayMode, name: string) =>
    setter((m) => ({ ...m, [name]: m[name] === "amount" ? "pct" : "amount" }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {COLUMNS.map((col) => {
          const on = visible[col.key];
          return (
            <button
              key={col.key}
              type="button"
              onClick={() => toggle(col.key)}
              aria-pressed={on}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                on
                  ? "bg-brand-green/15 text-brand-green dark:text-emerald-400"
                  : "border border-black/10 dark:border-white/15 text-black/45 dark:text-white/50 hover:text-black/70 dark:hover:text-white/75"
              }`}
            >
              {col.label}
            </button>
          );
        })}
        {/* Session chip appears only while an extended window is active;
            its label follows the window (Gecə / Açılışdan əvvəl / …). */}
        {extended && (
          <button
            type="button"
            onClick={() => toggle("extended")}
            aria-pressed={visible.extended}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
              visible.extended
                ? "bg-brand-green/15 text-brand-green dark:text-emerald-400"
                : "border border-black/10 dark:border-white/15 text-black/45 dark:text-white/50 hover:text-black/70 dark:hover:text-white/75"
            }`}
          >
            {EXTENDED_META[extended.mode].label}
          </button>
        )}
      </div>

      <ul className="flex flex-col divide-y divide-[color:var(--glass-border)]">
        {items.map((item) => {
          const ticker = (item.symbol ?? "").trim().toUpperCase();
          const primary = item.isCash ? item.name : ticker || item.name;
          const secondary =
            !item.isCash && ticker && item.name.toUpperCase() !== ticker
              ? item.name
              : null;

          const showPrice =
            visible.price && item.priceUsd != null && !item.isCash;
          const showTotal =
            visible.totalChange && item.changePct != null && !item.isCash;
          const showDay =
            visible.dayChange && item.dayChangePct != null && !item.isCash;
          const extQuote =
            extended && visible.extended && !item.isCash
              ? extended.quotes[ticker] ?? null
              : null;

          return (
            <li
              key={item.name}
              className="flex items-start gap-3 py-3"
            >
              {/* Identity: ticker over company name (+ percent of portfolio).
                  Rank + movement arrow + sector dot are vertically centered
                  against the two-line block. */}
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <RankBadge
                  rank={todayRank.get(item.name) ?? 0}
                  delta={
                    (yesterdayRank.get(item.name) ?? 0) -
                    (todayRank.get(item.name) ?? 0)
                  }
                />
                {item.color && (
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-0">
                  <span className="num text-lg font-semibold leading-tight tracking-wide text-black/85 dark:text-white/90">
                    {primary}
                  </span>
                  <div className="-mt-1 flex min-w-0 items-baseline gap-2">
                    {secondary && (
                      <span className="min-w-0 truncate text-[11px] leading-tight text-black/45 dark:text-white/50">
                        {secondary}
                      </span>
                    )}
                    <AnimatePresence initial={false}>
                      {visible.percent && (
                        <AnimatedFigure keyName="percent" inline>
                          <span className="num shrink-0 text-[11px] text-black/45 dark:text-white/50">
                            {(item.percent * 100).toFixed(1)}%
                          </span>
                        </AnimatedFigure>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* Numbers: value / price on row 1, total / day change badges on
                  row 2 (total = filled, day = outlined). The price/day column is
                  a fixed width so the value + total-change column lands on the
                  same vertical line across every row regardless of price width. */}
              <div className="grid shrink-0 grid-cols-[auto_52px] items-center gap-x-4 gap-y-1 text-right">
                <div className="num text-[13px] font-medium text-black/85 dark:text-white/90">
                  <AnimatePresence initial={false}>
                    {visible.value && (
                      <AnimatedFigure keyName="value" inline>
                        {formatAzn(item.valueAzn)}
                      </AnimatedFigure>
                    )}
                  </AnimatePresence>
                </div>
                <div className="num text-[13px] text-black/45 dark:text-white/50">
                  <AnimatePresence initial={false}>
                    {showPrice && (
                      <AnimatedFigure keyName="price" inline>
                        {usdFmt.format(item.priceUsd as number)}
                      </AnimatedFigure>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex justify-end">
                  <AnimatePresence initial={false}>
                    {showTotal && (
                      <AnimatedFigure keyName="totalChange">
                        <ChangeBadge
                          pct={item.changePct as number}
                          amountAzn={item.totalPnlAzn}
                          mode={totalMode[item.name] ?? "pct"}
                          onToggle={() => flipMode(setTotalMode, item.name)}
                        />
                      </AnimatedFigure>
                    )}
                  </AnimatePresence>
                </div>
                <div className="flex justify-end">
                  <AnimatePresence initial={false}>
                    {showDay && (
                      <AnimatedFigure keyName="dayChange">
                        <ChangeBadge
                          pct={item.dayChangePct as number}
                          amountAzn={item.dayChangeAzn}
                          mode={dayMode[item.name] ?? "pct"}
                          onToggle={() => flipMode(setDayMode, item.name)}
                          variant="outlined"
                        />
                      </AnimatedFigure>
                    )}
                  </AnimatePresence>
                </div>

                {/* Extended-hours line: session icon + the extended price
                    itself + its move vs the regular price. The wrapper div is
                    the grid item (col-span-2) so the line spans both columns;
                    rows without an extended quote render no extra grid row. */}
                {extQuote && extended && (
                  <div className="col-span-2 flex justify-end">
                    <AnimatePresence initial={false}>
                      <AnimatedFigure keyName="extended">
                        <span className="flex items-center gap-1.5">
                          <span
                            aria-hidden
                            className={`shrink-0 ${EXTENDED_META[extended.mode].iconTint}`}
                          >
                            {EXTENDED_META[extended.mode].icon}
                          </span>
                          <span className="num text-[12px] text-black/55 dark:text-white/60">
                            {usdFmt.format(extQuote.priceUsd)}
                          </span>
                          <ChangeBadge pct={extQuote.changePct} mode="pct" />
                        </span>
                      </AnimatedFigure>
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
