"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Masked } from "@/components/Masked";
import {
  formatAzn,
  formatGrouped,
  formatUnits,
  formatUsd,
} from "@/lib/portfolio";
import { ASSET_ICONS } from "@/components/assetIcons";
import type { AssetPosition } from "@/lib/personalAssets";

// "Aktivlərim" — the holder's whole personal book: İRF pays and the ETF
// positions from the Aktivlər ledger, ranked by value. The row anatomy
// deliberately mirrors Fond Portfeli's AllocationList (rank badge with the
// day's movement arrow, round icon chip, big ticker over the muted
// meta-line, fixed-width number grid, %↔₼ flip pills) — with Masked on the
// amounts, because unlike the fund list this card is personal.

export type IrfHoldingSummary = {
  units: number;
  avgBuyAzn: number | null;
  /** The unit price, for the Hazırki Qiymət column. */
  priceAzn: number;
  valueAzn: number;
  dayChangePct: number | null;
  /** The viewer's own ₼ day delta (their slice, not the fund's). */
  dayChangeAzn: number | null;
  totalPnlAzn: number | null;
};

type ColumnKey =
  | "value"
  | "price"
  | "totalChange"
  | "dayChange"
  | "percent"
  | "maya";

const COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "value", label: "Ümumi Dəyəri" },
  { key: "price", label: "Hazırki Qiymət" },
  { key: "totalChange", label: "Ümumi Dəyişim" },
  { key: "dayChange", label: "Günlük Dəyişim" },
  { key: "percent", label: "Faizlə Dəyəri" },
  { key: "maya", label: "Maya dəyəri" },
];

type Row = {
  key: string;
  icon: ReactNode;
  symbol: string;
  name: string;
  /** Paid basis, AZN — fractional unit counts stay off the collapsed row. */
  mayaAzn: number | null;
  /** Exact unit count — drill-down only. */
  units: number;
  avgText: string | null;
  priceText: string | null;
  valueAzn: number;
  dayChangePct: number | null;
  dayChangeAzn: number | null;
  totalPnlAzn: number | null;
  totalPnlPct: number | null;
};

function AnimatedFigure({
  keyName,
  inline = false,
  children,
}: {
  keyName: string;
  inline?: boolean;
  children: ReactNode;
}) {
  return (
    <motion.span
      key={keyName}
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
        ? "border border-transparent bg-brand-green/15 text-brand-green dark:text-emerald-400"
        : "border border-transparent bg-brand-red/15 text-brand-red dark:text-red-400"
      : up
        ? "border border-brand-green/40 text-brand-green dark:text-emerald-400"
        : "border border-brand-red/40 text-brand-red dark:text-red-400";
  // Amounts are personal — mask them; percentages stay visible app-wide.
  const label = showAmount ? (
    <Masked mask="••••">
      {`${(amountAzn as number) > 0 ? "+" : (amountAzn as number) < 0 ? "-" : ""}${formatAzn(Math.abs(amountAzn as number))}`}
    </Masked>
  ) : (
    `${up ? "+" : ""}${(pct * 100).toFixed(1)}%`
  );
  const base = `num inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${cls}`;
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

// Same lightweight ranking recipe as AllocationList: yesterday's value is
// derived from today's day change, so the arrow shows intraday rank moves.
function yesterdayValueOf(r: Row): number {
  const dp = r.dayChangePct;
  if (dp == null || !Number.isFinite(dp) || 1 + dp === 0) return r.valueAzn;
  return r.valueAzn / (1 + dp);
}

function RankBadge({ rank, delta }: { rank: number; delta: number }) {
  return (
    <div className="num flex w-6 shrink-0 items-center text-xs text-black/55 dark:text-white/60 sm:w-7">
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

export function AssetHoldingsCard({
  positions,
  irf,
  showBuyHint = true,
}: {
  positions: AssetPosition[];
  /** The viewer's İRF pay position. */
  irf?: IrfHoldingSummary | null;
  /** false for İsmayıl — the how-to-order note is not for the counterparty. */
  showBuyHint?: boolean;
}) {
  const [visible, setVisible] = useState<Record<ColumnKey, boolean>>({
    value: true,
    price: true,
    totalChange: true,
    dayChange: true,
    percent: true,
    maya: true,
  });
  const [dayMode, setDayMode] = useState<Record<string, "pct" | "amount">>({});
  const [totalMode, setTotalMode] = useState<Record<string, "pct" | "amount">>(
    {},
  );
  // Which rows have their detail drill-down open (AllocationList recipe).
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});

  const rows: Row[] = [
    ...(irf
      ? [
          {
            key: "İRF",
            icon: ASSET_ICONS.irf,
            symbol: "İRF",
            name: "İRF Payı",
            mayaAzn:
              irf.totalPnlAzn != null
                ? irf.valueAzn - irf.totalPnlAzn
                : irf.avgBuyAzn != null
                  ? irf.avgBuyAzn * irf.units
                  : null,
            units: irf.units,
            avgText:
              irf.avgBuyAzn != null
                ? `${formatGrouped(irf.avgBuyAzn, 2)}₼`
                : null,
            priceText: formatAzn(irf.priceAzn),
            valueAzn: irf.valueAzn,
            dayChangePct: irf.dayChangePct,
            dayChangeAzn: irf.dayChangeAzn,
            totalPnlAzn: irf.totalPnlAzn,
            totalPnlPct:
              irf.totalPnlAzn != null && irf.valueAzn - irf.totalPnlAzn > 0
                ? irf.totalPnlAzn / (irf.valueAzn - irf.totalPnlAzn)
                : null,
          },
        ]
      : []),
    ...positions.map((p) => ({
      key: p.symbol,
      icon: p.iconKey ? ASSET_ICONS[p.iconKey] : null,
      symbol: p.symbol,
      name: p.label,
      mayaAzn: p.costBasisAzn,
      units: p.units,
      avgText: p.avgBuyUsd != null ? `${formatGrouped(p.avgBuyUsd, 2)}$` : null,
      priceText: p.priceUsd != null ? formatUsd(p.priceUsd) : null,
      valueAzn: p.valueAzn ?? 0,
      dayChangePct: p.dayChangePct,
      dayChangeAzn: p.dayChangeAzn,
      totalPnlAzn: p.totalPnlAzn,
      totalPnlPct: p.totalPnlPct,
    })),
  ].sort((a, b) => b.valueAzn - a.valueAzn);
  if (rows.length === 0) return null;

  const totalValue = rows.reduce((s, r) => s + r.valueAzn, 0);
  const hasPnl = rows.some((r) => r.totalPnlAzn != null);
  const totalPnl = hasPnl
    ? rows.reduce((s, r) => s + (r.totalPnlAzn ?? 0), 0)
    : null;

  const yesterdayRanked = [...rows].sort(
    (a, b) => yesterdayValueOf(b) - yesterdayValueOf(a),
  );
  const yesterdayRank = new Map(yesterdayRanked.map((r, i) => [r.key, i + 1]));

  const toggle = (key: ColumnKey) =>
    setVisible((v) => ({ ...v, [key]: !v[key] }));
  const flipMode = (setter: typeof setDayMode, key: string) =>
    setter((m) => ({ ...m, [key]: m[key] === "amount" ? "pct" : "amount" }));

  return (
    <div className="glass flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[14px] uppercase tracking-[0.22em] text-brand-green/80">
          Aktivlərim
        </span>
        <span className="num text-sm font-semibold text-black/85 dark:text-white/90">
          <Masked mask="••••">{formatAzn(totalValue)}</Masked>
          {totalPnl != null ? (
            <span
              className={`ml-2 text-[11px] font-medium ${
                totalPnl >= 0
                  ? "text-brand-green dark:text-emerald-400"
                  : "text-brand-red dark:text-red-400"
              }`}
            >
              <Masked mask="••••">
                {`${totalPnl >= 0 ? "+" : ""}${formatAzn(totalPnl)}`}
              </Masked>
            </span>
          ) : null}
        </span>
      </div>

      {/* Column chips — the AllocationList recipe. */}
      <div className="flex flex-wrap gap-1.5">
        {COLUMNS.map((col) => {
          const on = visible[col.key];
          return (
            <button
              key={col.key}
              type="button"
              onClick={() => toggle(col.key)}
              aria-pressed={on}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                on
                  ? "border-transparent bg-brand-green/15 text-brand-green dark:text-emerald-400"
                  : "border-black/10 dark:border-white/15 text-black/45 dark:text-white/50 hover:text-black/70 dark:hover:text-white/75"
              }`}
            >
              {col.label}
            </button>
          );
        })}
      </div>

      <ul className="flex flex-col divide-y divide-[color:var(--glass-border)]">
        {rows.map((row, i) => {
          const rank = i + 1;
          const delta = (yesterdayRank.get(row.key) ?? rank) - rank;
          const showPrice = visible.price && row.priceText != null;
          // A gifted position has no basis to percent against (pct null) but
          // still shows its ₼ gain as an amount-only pill.
          const showTotal =
            visible.totalChange &&
            (row.totalPnlPct != null || row.totalPnlAzn != null);
          const showDay = visible.dayChange && row.dayChangePct != null;
          const isOpen = !!openRows[row.key];
          const toggleOpen = () =>
            setOpenRows((m) => ({ ...m, [row.key]: !m[row.key] }));
          return (
            <li key={row.key} className="flex flex-col py-3">
              <div className="flex items-start gap-2 sm:gap-3">
                <div
                  className="flex min-w-0 flex-1 cursor-pointer select-none items-center gap-2 sm:gap-2.5"
                  role="button"
                  tabIndex={0}
                  aria-expanded={isOpen}
                  onClick={toggleOpen}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleOpen();
                    }
                  }}
                >
                  <RankBadge rank={rank} delta={delta} />
                  <span
                    aria-hidden
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/5 dark:bg-white/10"
                  >
                    {row.icon}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="num min-w-0 truncate text-base font-semibold leading-tight tracking-wide text-black/85 dark:text-white/90 sm:text-lg">
                        {row.symbol}
                      </span>
                      <svg
                        aria-hidden
                        viewBox="0 0 10 6"
                        className={`h-1.5 w-2.5 shrink-0 fill-none stroke-current text-black/30 transition-transform dark:text-white/35 ${
                          isOpen ? "rotate-180" : ""
                        }`}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m1 1 4 4 4-4" />
                      </svg>
                    </span>
                    {/* One row, always: the name is the only shrinkable
                        segment (truncates first), the numeric segments stay
                        whole, and anything still over the edge clips instead
                        of wrapping. */}
                    <div className="-mt-1 flex min-w-0 items-baseline gap-x-2 overflow-hidden">
                      <span className="min-w-0 truncate text-[11px] leading-tight text-black/45 dark:text-white/50">
                        {row.name}
                      </span>
                      <span className="shrink-0">
                        <AnimatePresence initial={false}>
                          {visible.percent && totalValue > 0 && (
                            <AnimatedFigure keyName="percent" inline>
                              <span className="num whitespace-nowrap text-[11px] text-black/45 dark:text-white/50">
                                {((row.valueAzn / totalValue) * 100).toFixed(1)}%
                              </span>
                            </AnimatedFigure>
                          )}
                        </AnimatePresence>
                      </span>
                      <span className="shrink-0">
                        <AnimatePresence initial={false}>
                          {visible.maya && row.mayaAzn != null && (
                            <AnimatedFigure keyName="maya" inline>
                              <span className="num whitespace-nowrap text-[11px] text-black/45 dark:text-white/50">
                                maya:{" "}
                                <Masked mask="••••">
                                  {formatAzn(row.mayaAzn)}
                                </Masked>
                                {row.avgText ? ` · ort. ${row.avgText}` : ""}
                              </span>
                            </AnimatedFigure>
                          )}
                        </AnimatePresence>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid shrink-0 grid-cols-[auto_56px] items-center gap-x-2 gap-y-1 text-right sm:grid-cols-[auto_64px] sm:gap-x-4">
                  <div className="num text-xs font-medium text-black/85 dark:text-white/90 sm:text-[13px]">
                    <AnimatePresence initial={false}>
                      {visible.value && (
                        <AnimatedFigure keyName="value" inline>
                          <Masked mask="••••">{formatAzn(row.valueAzn)}</Masked>
                        </AnimatedFigure>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="num text-xs text-black/45 dark:text-white/50 sm:text-[13px]">
                    <AnimatePresence initial={false}>
                      {showPrice && (
                        <AnimatedFigure keyName="price" inline>
                          {row.priceText}
                        </AnimatedFigure>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="flex justify-end">
                    <AnimatePresence initial={false}>
                      {showTotal && (
                        <AnimatedFigure keyName="totalChange">
                          <ChangeBadge
                            pct={row.totalPnlPct ?? 0}
                            amountAzn={row.totalPnlAzn}
                            mode={
                              row.totalPnlPct == null
                                ? "amount"
                                : (totalMode[row.key] ?? "pct")
                            }
                            onToggle={
                              row.totalPnlPct == null
                                ? undefined
                                : () => flipMode(setTotalMode, row.key)
                            }
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
                            pct={row.dayChangePct as number}
                            amountAzn={row.dayChangeAzn}
                            mode={dayMode[row.key] ?? "pct"}
                            onToggle={() => flipMode(setDayMode, row.key)}
                            variant="outlined"
                          />
                        </AnimatedFigure>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* Detail drill-down — the exact figures the collapsed row
                  rounds or omits, in the AllocationList panel style. */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pl-4 pt-2.5 text-[11px] text-black/45 dark:text-white/50 sm:pl-12">
                      <span>
                        Ədəd:{" "}
                        <span className="num text-black/70 dark:text-white/75">
                          <Masked mask="••">{formatUnits(row.units)}</Masked>
                        </span>
                      </span>
                      {row.mayaAzn != null && (
                        <span>
                          Ödənilən məbləğ:{" "}
                          <span className="num text-black/70 dark:text-white/75">
                            <Masked mask="••••">
                              {formatAzn(row.mayaAzn)}
                            </Masked>
                          </span>
                        </span>
                      )}
                      {row.avgText && (
                        <span>
                          Ortalama alış qiyməti:{" "}
                          <span className="num text-black/70 dark:text-white/75">
                            {row.avgText}
                          </span>
                        </span>
                      )}
                      {totalValue > 0 && (
                        <span>
                          Portfel payı:{" "}
                          <span className="num text-black/70 dark:text-white/75">
                            {((row.valueAzn / totalValue) * 100).toFixed(1)}%
                          </span>
                        </span>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>

      {showBuyHint && (
        <p className="text-[11px] leading-relaxed text-black/45 dark:text-white/50">
          SPY, IBIT, GLDM və SIVR — İRF paylarından ayrı saxlanılan şəxsi ETF
          aktivləri. Almaq və ya satmaq üçün İsmayıl ilə əlaqə saxlayın —
          sifarişlər şifahi qəbul olunur.
        </p>
      )}
    </div>
  );
}
