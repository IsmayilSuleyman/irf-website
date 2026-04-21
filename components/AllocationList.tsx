"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { formatAzn } from "@/lib/portfolio";

type Item = {
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

type ColumnKey =
  | "dayChange"
  | "totalChange"
  | "price"
  | "value"
  | "percent";

const COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "dayChange", label: "Günlük Dəyişim" },
  { key: "totalChange", label: "Ümumi Dəyişim" },
  { key: "price", label: "Hazırki Qiymət" },
  { key: "value", label: "Ümumi Dəyəri" },
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
        ? "bg-brand-green/15 text-brand-green"
        : "bg-brand-red/15 text-brand-red"
      : up
        ? "border border-brand-green/40 text-brand-green"
        : "border border-brand-red/40 text-brand-red";
  const label = showAmount
    ? formatSignedAzn(amountAzn as number)
    : `${up ? "+" : ""}${(pct * 100).toFixed(1)}%`;
  const base = `num rounded-md px-1.5 py-0.5 text-[11px] font-medium ${cls}`;
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

export function AllocationList({ items }: { items: Item[] }) {
  const [visible, setVisible] = useState<Record<ColumnKey, boolean>>({
    dayChange: true,
    totalChange: true,
    price: true,
    value: true,
    percent: true,
  });
  // Per-row mode for the two change badges: "pct" (default) vs "amount" (AZN).
  // Clicking a badge flips just that row's view so you can compare holdings
  // side-by-side in either unit without affecting the others.
  const [dayMode, setDayMode] = useState<Record<string, "pct" | "amount">>({});
  const [totalMode, setTotalMode] = useState<Record<string, "pct" | "amount">>(
    {},
  );

  if (!items || items.length === 0) {
    return <div className="text-black/40">Məlumat yoxdur.</div>;
  }

  const toggle = (key: ColumnKey) =>
    setVisible((v) => ({ ...v, [key]: !v[key] }));
  const flipMode = (
    setter: typeof setDayMode,
    name: string,
  ) =>
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
                  ? "bg-brand-green/15 text-brand-green"
                  : "border border-black/10 text-black/40 hover:text-black/70"
              }`}
            >
              {col.label}
            </button>
          );
        })}
      </div>

      <ul className="flex flex-col divide-y divide-[color:var(--glass-border)]">
        {items.map((item) => {
          const metaCluster = (
            <AnimatePresence initial={false}>
              {visible.price && item.priceUsd != null && !item.isCash && (
                <AnimatedFigure keyName="price">
                  <span className="num text-xs text-black/40">
                    {usdFmt.format(item.priceUsd)}
                  </span>
                </AnimatedFigure>
              )}
              {visible.totalChange &&
                item.changePct != null &&
                !item.isCash && (
                  <AnimatedFigure keyName="totalChange">
                    <ChangeBadge
                      pct={item.changePct}
                      amountAzn={item.totalPnlAzn}
                      mode={totalMode[item.name] ?? "pct"}
                      onToggle={() => flipMode(setTotalMode, item.name)}
                    />
                  </AnimatedFigure>
                )}
              {visible.dayChange &&
                item.dayChangePct != null &&
                !item.isCash && (
                  <AnimatedFigure keyName="dayChange">
                    <ChangeBadge
                      pct={item.dayChangePct}
                      amountAzn={item.dayChangeAzn}
                      mode={dayMode[item.name] ?? "pct"}
                      onToggle={() => flipMode(setDayMode, item.name)}
                      variant="outlined"
                    />
                  </AnimatedFigure>
                )}
            </AnimatePresence>
          );
          const valueCluster = (
            <AnimatePresence initial={false} mode="popLayout">
              {visible.value && (
                <AnimatedFigure keyName="value" inline>
                  {formatAzn(item.valueAzn)}
                </AnimatedFigure>
              )}
              {visible.percent && (
                <AnimatedFigure keyName="percent" inline>
                  <span
                    className={`text-black/45 ${visible.value ? "ml-2" : ""}`}
                  >
                    {(item.percent * 100).toFixed(1)}%
                  </span>
                </AnimatedFigure>
              )}
            </AnimatePresence>
          );
          const hasMeta =
            !item.isCash &&
            ((visible.price && item.priceUsd != null) ||
              (visible.totalChange && item.changePct != null) ||
              (visible.dayChange && item.dayChangePct != null));
          const hasValueCluster = visible.value || visible.percent;

          return (
            <li
              key={item.name}
              className="flex flex-col gap-1.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              {/* Line 1: color + name (+ desktop meta) + mobile value cluster */}
              <div className="flex min-w-0 items-center gap-2">
                {item.color && (
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                )}
                <span className="min-w-0 flex-1 truncate text-sm text-black/85 sm:flex-none">
                  {item.name}
                </span>
                <div className="hidden items-center gap-2 sm:flex">
                  {metaCluster}
                </div>
                {hasValueCluster && (
                  <div className="num ml-auto shrink-0 text-sm text-black/75 sm:hidden">
                    {valueCluster}
                  </div>
                )}
              </div>

              {/* Line 2 (mobile only): price + badges indented under the name */}
              {hasMeta && (
                <div className="flex items-center gap-2 pl-[18px] sm:hidden">
                  {metaCluster}
                </div>
              )}

              {/* Desktop-only right cluster */}
              {hasValueCluster && (
                <div className="num hidden shrink-0 text-sm text-black/75 sm:block">
                  {valueCluster}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
