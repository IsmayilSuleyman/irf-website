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

function ChangeBadge({
  pct,
  variant = "filled",
}: {
  pct: number;
  variant?: "filled" | "outlined";
}) {
  const up = pct >= 0;
  const cls =
    variant === "filled"
      ? up
        ? "bg-brand-green/15 text-brand-green"
        : "bg-brand-red/15 text-brand-red"
      : up
        ? "border border-brand-green/40 text-brand-green"
        : "border border-brand-red/40 text-brand-red";
  const sign = up ? "+" : "";
  return (
    <span
      className={`num rounded-md px-1.5 py-0.5 text-[11px] font-medium ${cls}`}
    >
      {sign}
      {(pct * 100).toFixed(1)}%
    </span>
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

  if (!items || items.length === 0) {
    return <div className="text-black/40">Məlumat yoxdur.</div>;
  }

  const toggle = (key: ColumnKey) =>
    setVisible((v) => ({ ...v, [key]: !v[key] }));

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
        {items.map((item) => (
          <li
            key={item.name}
            className="flex items-center justify-between gap-4 py-3"
          >
            <div className="flex min-w-0 items-center gap-2">
              {item.color && (
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
              )}
              <span className="truncate text-sm text-black/85">
                {item.name}
              </span>
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
                      <ChangeBadge pct={item.changePct} />
                    </AnimatedFigure>
                  )}
                {visible.dayChange &&
                  item.dayChangePct != null &&
                  !item.isCash && (
                    <AnimatedFigure keyName="dayChange">
                      <ChangeBadge pct={item.dayChangePct} variant="outlined" />
                    </AnimatedFigure>
                  )}
              </AnimatePresence>
            </div>
            {(visible.value || visible.percent) && (
              <div className="num shrink-0 text-sm text-black/75">
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
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
