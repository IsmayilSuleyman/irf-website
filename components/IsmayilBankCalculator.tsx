"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { formatAzn, formatGrouped, formatGroupedTrim, NBSP } from "@/lib/portfolio";
import { DEFAULT_TERMS, type ProductTerm } from "@/lib/bankTermsData";

const MIN_AMOUNT = 50;
const MAX_AMOUNT = 2000;

function formatAmount(value: number) {
  return `${formatGrouped(value, 0)}${NBSP}₼`;
}

const formatMoney = formatAzn;

function formatRate(rate: number) {
  return `${formatGroupedTrim(rate, 2)} %`;
}

function calculateMonthlyPayment(amount: number, period: number, annualRate: number) {
  if (annualRate === 0) {
    return amount / period;
  }

  const monthlyRate = annualRate / 100 / 12;
  return amount * monthlyRate / (1 - Math.pow(1 + monthlyRate, -period));
}

function SliderField({
  editable = false,
  label,
  max,
  maxLabel,
  min,
  minLabel,
  onChange,
  step = 1,
  value,
  valueLabel,
}: {
  editable?: boolean;
  label: string;
  max: number;
  maxLabel: string;
  min: number;
  minLabel: string;
  onChange: (value: number) => void;
  step?: number;
  value: number;
  valueLabel: string;
}) {
  const [inputValue, setInputValue] = useState(String(value));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) setInputValue(String(value));
  }, [value, isFocused]);

  // Guard the degenerate single-option range (max === min) against NaN%.
  const progress = `${max > min ? ((value - min) / (max - min)) * 100 : 0}%`;

  return (
    <div className="space-y-2.5">
      <div className="flex items-end justify-between gap-4">
        <p className="text-sm font-medium text-black/55 dark:text-white/60">{label}</p>
        {editable ? (
          <div className="flex items-center gap-0.5">
            <input
              type="number"
              value={inputValue}
              min={min}
              max={max}
              onFocus={() => setIsFocused(true)}
              onChange={(e) => {
                setInputValue(e.target.value);
                const n = Number(e.target.value);
                if (e.target.value !== "" && n >= min && n <= max) onChange(n);
              }}
              onBlur={() => {
                setIsFocused(false);
                const n = Math.min(max, Math.max(min, Number(inputValue) || min));
                onChange(n);
                setInputValue(String(n));
              }}
              className="num w-[5ch] bg-transparent text-right text-[1.6rem] font-semibold tracking-[-0.04em] text-ink dark:text-white/90 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus:border-b-2 focus:border-bank-blue dark:border-blue-400"
            />
            <span className="num text-[1.6rem] font-semibold tracking-[-0.04em] text-ink dark:text-white/90">₼</span>
          </div>
        ) : (
          <p className="num text-[1.6rem] font-semibold tracking-[-0.04em] text-ink dark:text-white/90">
            {valueLabel}
          </p>
        )}
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="bank-range"
        style={{ "--range-progress": progress } as CSSProperties}
        aria-label={label}
      />

      <div className="flex items-center justify-between text-xs text-black/45 dark:text-white/50">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-white/70">{label}</span>
      <span className="num text-[15px] font-semibold tabular-nums text-white">
        {value}
      </span>
    </div>
  );
}

export function IsmayilBankCalculator({
  terms,
  initialAmountAzn,
}: {
  terms?: ProductTerm[];
  /** Preset from the credit-offer banner's "Hesabla" link; clamped to the
   *  slider's range. */
  initialAmountAzn?: number;
}) {
  // Tiers come from Supabase (İsmayıl edits them any time). The slider moves
  // over the available tiers by index, so gaps in the month list are fine.
  const tiers = useMemo(() => {
    const list = (terms?.length ? terms : DEFAULT_TERMS.credit)
      .filter((t) => t.termMonths > 0)
      .slice()
      .sort((a, b) => a.termMonths - b.termMonths);
    return list.length > 0 ? list : DEFAULT_TERMS.credit;
  }, [terms]);

  const [amount, setAmount] = useState(() =>
    initialAmountAzn != null && Number.isFinite(initialAmountAzn)
      ? Math.min(2000, Math.max(50, Math.round(initialAmountAzn)))
      : 250,
  );
  const [tierIndex, setTierIndex] = useState(() => {
    const i = tiers.findIndex((t) => t.termMonths === 6);
    return i >= 0 ? i : Math.floor((tiers.length - 1) / 2);
  });

  const tier = tiers[Math.min(tierIndex, tiers.length - 1)];
  const period = tier.termMonths;
  const annualRate = tier.annualRatePct;

  const { monthlyPayment, totalInterest, totalRepayment } = useMemo(() => {
    const monthly = calculateMonthlyPayment(amount, period, annualRate);
    const total = monthly * period;
    const interest = total - amount;

    return {
      monthlyPayment: monthly,
      totalInterest: interest,
      totalRepayment: total,
    };
  }, [amount, annualRate, period]);

  // Principal's share of the total repayment, for the split bar.
  const principalPct =
    totalRepayment > 0 ? (amount / totalRepayment) * 100 : 100;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)] lg:items-start lg:gap-8">
      {/* Controls sit directly on the section card — the page provides the
          chrome, the component provides the inputs. */}
      <div className="space-y-7 lg:pt-1">
        <SliderField
          editable
          label="Məbləğ"
          min={MIN_AMOUNT}
          max={MAX_AMOUNT}
          value={amount}
          onChange={setAmount}
          minLabel={formatAmount(MIN_AMOUNT)}
          maxLabel={formatAmount(MAX_AMOUNT)}
          valueLabel={formatAmount(amount)}
        />

        {/* Quick presets — one tap to the common asks, and they keep the
            control column visually balanced against the result panel. */}
        <div className="flex flex-wrap gap-2">
          {[100, 250, 500, 1000, 2000].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setAmount(preset)}
              aria-pressed={amount === preset}
              className={`num rounded-full border px-3.5 py-1.5 text-[13px] font-semibold tabular-nums transition ${
                amount === preset
                  ? "border-bank-blue bg-bank-blue text-white shadow-sm"
                  : "border-black/10 dark:border-white/15 bg-white/70 dark:bg-white/5 text-black/60 dark:text-white/65 hover:border-bank-blue/45 hover:text-bank-blue dark:hover:text-blue-400"
              }`}
            >
              {formatAmount(preset)}
            </button>
          ))}
        </div>

        <SliderField
          label="Müddət"
          min={0}
          max={tiers.length - 1}
          value={Math.min(tierIndex, tiers.length - 1)}
          onChange={setTierIndex}
          minLabel={`${tiers[0].termMonths} ay`}
          maxLabel={`${tiers[tiers.length - 1].termMonths} ay`}
          valueLabel={`${period} ay`}
        />
      </div>

      {/* Result panel: the product's blue identity, calm typography, and a
          principal-vs-interest split bar so the cost of the loan is a
          picture, not just a row. */}
      <div className="rounded-card bg-[linear-gradient(160deg,#2f61d8_0%,#2854be_100%)] p-6 text-white sm:p-7">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
          Aylıq ödəniş
        </p>
        <p className="num mt-2 text-[2.4rem] font-semibold leading-none tracking-[-0.04em] sm:text-[2.8rem]">
          {formatMoney(monthlyPayment)}
        </p>
        <p className="mt-2 text-xs text-white/65">
          {period} ay ərzində, illik {formatRate(annualRate)}
        </p>

        <div className="mt-6 flex h-1.5 w-full overflow-hidden rounded-full bg-white/25" aria-hidden>
          <span
            className="h-full rounded-full bg-white/95"
            style={{ width: `${principalPct}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-white/70">
          <span className="tabular-nums">Əsas: {formatMoney(amount)}</span>
          <span className="tabular-nums">Faiz: {formatMoney(totalInterest)}</span>
        </div>

        <div className="mt-6 space-y-3 border-t border-white/15 pt-5">
          <SummaryRow label="Ümumi ödəniş" value={formatMoney(totalRepayment)} />
          <SummaryRow label="Ümumi faiz" value={formatMoney(totalInterest)} />
          <SummaryRow label="İllik faiz" value={formatRate(annualRate)} />
        </div>

        <p className="mt-5 text-[11px] leading-5 text-white/60">
          İlkin hesablama. Yekun şərtlər müraciət zamanı təsdiqlənir.
        </p>
      </div>
    </div>
  );
}
