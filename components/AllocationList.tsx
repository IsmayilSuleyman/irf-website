"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { formatAzn } from "@/lib/portfolio";

type Item = {
  name: string;
  valueAzn: number;
  percent: number;
  priceUsd?: number;
  dailyPriceChangeUsd?: number | null;
  dailyChangePct?: number | null;
  shares?: number;
  avgBuyPriceUsd?: number | null;
  dayValueChangeUsd?: number | null;
  overallChangePct?: number | null;
  totalProfitLossUsd?: number | null;
};

type Tone = "positive" | "negative" | "neutral";

const SOFT_TRANSITION = {
  duration: 0.24,
  ease: [0.22, 1, 0.36, 1] as const,
};

const DOT_COLORS = [
  "#ec4899",
  "#0ea5e9",
  "#22c55e",
  "#4ade80",
  "#38bdf8",
  "#14b8a6",
  "#3b82f6",
  "#2dd4bf",
  "#0ea5e9",
  "#8b5cf6",
];

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactPctFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function AllocationList({ items }: { items: Item[] }) {
  if (!items || items.length === 0) {
    return <div className="text-white/40">Melumat yoxdur.</div>;
  }

  const max = Math.max(...items.map((i) => i.percent), 0.0001);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {[
          "Gunluk deyisim",
          "Umumi deyisim",
          "Hazirki qiymet",
          "Umumi deyeri",
          "Faizle deyeri",
        ].map((label) => (
          <span
            key={label}
            className="rounded-full bg-brand-green/[0.10] px-3 py-1 text-[11px] font-semibold text-brand-green/90"
          >
            {label}
          </span>
        ))}
      </div>

      <div className="text-[11px] text-black/38">
        Qiymet ve deyisim melumatlarina toxunaraq faiz ve dollar gorunusleri
        arasinda kecid edin.
      </div>

      <ul className="flex flex-col">
        {items.map((item, index) => (
          <HoldingRow
            key={item.name}
            item={item}
            max={max}
            color={DOT_COLORS[index % DOT_COLORS.length]}
          />
        ))}
      </ul>
    </div>
  );
}

function HoldingRow({
  item,
  max,
  color,
}: {
  item: Item;
  max: number;
  color: string;
}) {
  const [showPriceChange, setShowPriceChange] = useState(false);
  const [showDayValueChange, setShowDayValueChange] = useState(false);
  const [showTotalProfitLoss, setShowTotalProfitLoss] = useState(false);

  const pricePrimary =
    item.priceUsd != null && item.priceUsd > 0 ? formatUsd(item.priceUsd) : "--";
  const priceSecondary =
    item.dailyPriceChangeUsd != null
      ? formatSignedUsd(item.dailyPriceChangeUsd)
      : null;

  const dayPrimary =
    item.dailyChangePct != null
      ? formatSignedPct(item.dailyChangePct)
      : item.dayValueChangeUsd != null
        ? formatSignedUsd(item.dayValueChangeUsd)
        : "--";
  const daySecondary =
    item.dailyChangePct != null && item.dayValueChangeUsd != null
      ? formatSignedUsd(item.dayValueChangeUsd)
      : null;

  const overallPrimary =
    item.overallChangePct != null
      ? formatSignedPct(item.overallChangePct)
      : item.totalProfitLossUsd != null
        ? formatSignedUsd(item.totalProfitLossUsd)
        : "--";
  const overallSecondary =
    item.overallChangePct != null && item.totalProfitLossUsd != null
      ? formatSignedUsd(item.totalProfitLossUsd)
      : null;

  const priceTone = getTone(item.dailyPriceChangeUsd);
  const dayTone = getTone(item.dayValueChangeUsd ?? item.dailyChangePct);
  const overallTone = getTone(item.totalProfitLossUsd ?? item.overallChangePct);

  return (
    <motion.li
      layout
      transition={SOFT_TRANSITION}
      className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="min-w-0 text-[15px] font-medium text-black/80">
              {item.name}
            </span>

            <ToggleMetric
              primary={pricePrimary}
              secondary={priceSecondary}
              showSecondary={showPriceChange}
              onToggle={() => setShowPriceChange((value) => !value)}
              baseClassName="num inline-flex min-h-7 items-center rounded-md px-1 py-0.5 text-sm transition-colors duration-200"
              primaryClassName="text-black/42 hover:bg-black/[0.03] hover:text-black/58"
              secondaryClassName={plainToneClass(priceTone)}
              ariaLabel={`Toggle ${item.name} current price and daily price change`}
            />

            <ToggleMetric
              primary={dayPrimary}
              secondary={daySecondary}
              showSecondary={showDayValueChange}
              onToggle={() => setShowDayValueChange((value) => !value)}
              baseClassName={`num inline-flex min-h-8 items-center rounded-full border px-2.5 py-1 text-[12px] font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] ${badgeToneClass(dayTone)}`}
              primaryClassName=""
              secondaryClassName=""
              ariaLabel={`Toggle ${item.name} daily percent change and daily profit or loss`}
            />

            <ToggleMetric
              primary={overallPrimary}
              secondary={overallSecondary}
              showSecondary={showTotalProfitLoss}
              onToggle={() => setShowTotalProfitLoss((value) => !value)}
              baseClassName={`num inline-flex min-h-8 items-center rounded-full border px-2.5 py-1 text-[12px] font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] ${badgeToneClass(overallTone)}`}
              primaryClassName=""
              secondaryClassName=""
              ariaLabel={`Toggle ${item.name} overall percent change and total profit or loss`}
            />
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-baseline gap-2 text-right">
          <span className="num text-[15px] font-semibold text-black/75">
            {formatAzn(item.valueAzn)}
          </span>
          <span className="num text-[14px] text-black/40">
            {compactPctFormatter.format(item.percent * 100)}%
          </span>
        </div>
      </div>

      <div className="h-px w-full overflow-hidden rounded-full bg-brand-green/[0.14]">
        <motion.div
          layout
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="h-full rounded-full bg-gradient-to-r from-brand-green/75 via-brand-green to-brand-green-deep"
          style={{ width: `${(item.percent / max) * 100}%` }}
        />
      </div>
    </motion.li>
  );
}

function ToggleMetric({
  primary,
  secondary,
  showSecondary,
  onToggle,
  baseClassName,
  primaryClassName,
  secondaryClassName,
  ariaLabel,
}: {
  primary: string;
  secondary: string | null;
  showSecondary: boolean;
  onToggle: () => void;
  baseClassName: string;
  primaryClassName: string;
  secondaryClassName: string;
  ariaLabel: string;
}) {
  const enabled = secondary != null;
  const currentText = showSecondary && enabled ? secondary : primary;
  const currentClassName =
    showSecondary && enabled ? secondaryClassName : primaryClassName;

  if (!enabled) {
    return (
      <span className={`${baseClassName} ${currentClassName}`.trim()}>
        {primary}
      </span>
    );
  }

  return (
    <motion.button
      layout
      transition={SOFT_TRANSITION}
      type="button"
      onClick={onToggle}
      aria-label={ariaLabel}
      aria-pressed={showSecondary}
      whileTap={{ scale: 0.985 }}
      className={`${baseClassName} ${currentClassName} cursor-pointer`.trim()}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={showSecondary ? "secondary" : "primary"}
          initial={{ opacity: 0, y: 7, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -7, filter: "blur(4px)" }}
          transition={SOFT_TRANSITION}
          className="inline-block whitespace-nowrap"
        >
          {currentText}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

function getTone(value: number | null | undefined): Tone {
  if (value == null || value === 0) return "neutral";
  return value > 0 ? "positive" : "negative";
}

function badgeToneClass(tone: Tone): string {
  if (tone === "positive") {
    return "border-brand-green/25 bg-brand-green/[0.10] text-brand-green";
  }

  if (tone === "negative") {
    return "border-brand-red/20 bg-brand-red/[0.08] text-brand-red";
  }

  return "border-black/10 bg-black/[0.03] text-black/45";
}

function plainToneClass(tone: Tone): string {
  if (tone === "positive") return "bg-brand-green/[0.08] text-brand-green";
  if (tone === "negative") return "bg-brand-red/[0.06] text-brand-red";
  return "bg-black/[0.03] text-black/45";
}

function formatUsd(value: number): string {
  return usdFormatter.format(value);
}

function formatSignedUsd(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${usdFormatter.format(Math.abs(value))}`;
}

function formatSignedPct(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${compactPctFormatter.format(Math.abs(value) * 100)}%`;
}
