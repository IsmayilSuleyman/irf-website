"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { formatAzn, formatGrouped, NBSP } from "@/lib/portfolio";
import { DEFAULT_TERMS, type ProductTerm } from "@/lib/bankTermsData";

const MIN_AMOUNT = 50;
const MAX_AMOUNT = 2000;

function formatAmount(value: number) {
  return `${formatGrouped(value, 0)}${NBSP}₼`;
}

const formatMoney = formatAzn;

function formatRate(rate: number) {
  return `${formatGrouped(rate, 0)} %`;
}

function AmountField({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const [inputValue, setInputValue] = useState(String(value));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) setInputValue(String(value));
  }, [value, isFocused]);

  const progress = `${((value - MIN_AMOUNT) / (MAX_AMOUNT - MIN_AMOUNT)) * 100}%`;

  return (
    <div className="space-y-2.5">
      <div className="flex items-end justify-between gap-4">
        <p className="text-sm font-medium text-black/55 dark:text-white/60">Məbləğ</p>
        <div className="flex items-center gap-0.5">
          <input
            type="number"
            value={inputValue}
            min={MIN_AMOUNT}
            max={MAX_AMOUNT}
            onFocus={() => setIsFocused(true)}
            onChange={(e) => {
              setInputValue(e.target.value);
              const n = Number(e.target.value);
              if (e.target.value !== "" && n >= MIN_AMOUNT && n <= MAX_AMOUNT) onChange(n);
            }}
            onBlur={() => {
              setIsFocused(false);
              const n = Math.min(MAX_AMOUNT, Math.max(MIN_AMOUNT, Number(inputValue) || MIN_AMOUNT));
              onChange(n);
              setInputValue(String(n));
            }}
            className="num w-[5ch] bg-transparent text-right text-[1.6rem] font-semibold tracking-[-0.04em] text-ink dark:text-white/90 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus:border-b-2 focus:border-brand-green dark:border-emerald-400"
          />
          <span className="num text-[1.6rem] font-semibold tracking-[-0.04em] text-ink dark:text-white/90">₼</span>
        </div>
      </div>

      <input
        type="range"
        min={MIN_AMOUNT}
        max={MAX_AMOUNT}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="bank-range"
        style={{ "--range-progress": progress } as CSSProperties}
        aria-label="Depozit məbləği"
      />

      <div className="flex items-center justify-between text-xs text-black/45 dark:text-white/50">
        <span>{formatAmount(MIN_AMOUNT)}</span>
        <span>{formatAmount(MAX_AMOUNT)}</span>
      </div>
    </div>
  );
}

function PeriodPicker({
  options,
  value,
  onChange,
}: {
  options: ProductTerm[];
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <p className="text-sm font-medium text-black/55 dark:text-white/60">Müddət</p>
        <p className="num text-[1.6rem] font-semibold tracking-[-0.04em] text-ink dark:text-white/90">
          {value} ay
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {options.map((option) => {
          const isActive = option.termMonths === value;

          return (
            <button
              key={option.termMonths}
              type="button"
              onClick={() => onChange(option.termMonths)}
              aria-pressed={isActive}
              className={`rounded-card border px-4 py-3.5 text-left transition ${
                isActive
                  ? "border-brand-green bg-brand-green text-white shadow-sm"
                  : "border-black/10 dark:border-white/15 bg-white/70 dark:bg-white/5 text-black/70 dark:text-white/75 hover:-translate-y-0.5 hover:border-brand-green/45"
              }`}
            >
              <div className="text-[13px] font-medium tracking-[-0.01em]">
                {option.termMonths} ay
              </div>
              <div className={`num mt-1 text-[17px] font-semibold tabular-nums tracking-[-0.02em] ${isActive ? "text-white" : "text-brand-green-deep dark:text-emerald-400"}`}>
                {formatRate(option.annualRatePct)}
              </div>
            </button>
          );
        })}
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

export function IsmayilBankDepositCalculator({
  terms,
}: {
  terms?: ProductTerm[];
}) {
  // Tiers come from Supabase (İsmayıl edits them any time); the constants are
  // only a fallback if the caller passes nothing.
  const options = useMemo(() => {
    const list = (terms?.length ? terms : DEFAULT_TERMS.deposit)
      .filter((t) => t.termMonths > 0)
      .slice()
      .sort((a, b) => a.termMonths - b.termMonths);
    return list.length > 0 ? list : DEFAULT_TERMS.deposit;
  }, [terms]);

  const [amount, setAmount] = useState(500);
  const [period, setPeriod] = useState(
    () => options[Math.min(1, options.length - 1)].termMonths,
  );

  const selectedOption =
    options.find((option) => option.termMonths === period) ??
    options[Math.min(1, options.length - 1)];

  const annualRate = selectedOption.annualRatePct;

  // If İsmayıl removes the selected tier, fall back to the option's months so
  // the math always matches a real tier.
  const effectivePeriod = selectedOption.termMonths;

  const { maturityAmount, gainAmount } = useMemo(() => {
    const gain = amount * (annualRate / 100) * (effectivePeriod / 12);

    return {
      gainAmount: gain,
      maturityAmount: amount + gain,
    };
  }, [amount, annualRate, effectivePeriod]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)] lg:items-start lg:gap-8">
      <div className="space-y-7 lg:pt-1">
        <AmountField value={amount} onChange={setAmount} />
        <PeriodPicker options={options} value={effectivePeriod} onChange={setPeriod} />

        <p className="rounded-card bg-black/[0.04] dark:bg-white/5 px-4 py-3 text-xs leading-5 text-black/50 dark:text-white/55">
          Depozit qazancı müddətin sonunda hesablanır. Vaxtından əvvəl çıxarış
          zamanı faiz tətbiq olunmur.
        </p>
      </div>

      {/* Result panel: green product identity mirroring the credit card's
          composition, with the gain called out as its own chip. */}
      <div className="rounded-card bg-[linear-gradient(160deg,#16a34a_0%,#15803d_100%)] p-6 text-white sm:p-7">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
          Müddət sonu məbləğ
        </p>
        <p className="num mt-2 text-[2.4rem] font-semibold leading-none tracking-[-0.04em] sm:text-[2.8rem]">
          {formatMoney(maturityAmount)}
        </p>
        <p className="num mt-3 inline-flex rounded-full bg-white/15 px-3 py-1 text-[12px] font-semibold tabular-nums text-white">
          +{formatMoney(gainAmount)} qazanc
        </p>

        <div className="mt-6 space-y-3 border-t border-white/15 pt-5">
          <SummaryRow label="Əsas məbləğ" value={formatMoney(amount)} />
          <SummaryRow label="Qazanc" value={formatMoney(gainAmount)} />
          <SummaryRow label="İllik gəlir" value={formatRate(annualRate)} />
        </div>

        <p className="mt-5 text-[11px] leading-5 text-white/60">
          Hesablama illik gəlirin müddətə proporsional bölünməsi ilə aparılır.
        </p>
      </div>
    </div>
  );
}
