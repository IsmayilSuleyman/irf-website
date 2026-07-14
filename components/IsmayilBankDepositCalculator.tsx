"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { formatAzn, formatGrouped, NBSP } from "@/lib/portfolio";
import { DEFAULT_TERMS, type ProductTerm } from "@/lib/bankTerms";

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
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <p className="text-[1.1rem] tracking-[-0.03em] text-black/55 dark:text-white/60">Məbləğ</p>
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
            className="num w-[5ch] bg-transparent text-right text-[2rem] font-semibold tracking-[-0.06em] text-ink dark:text-white/90 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus:border-b-2 focus:border-blue-500 dark:border-blue-400"
          />
          <span className="num text-[2rem] font-semibold tracking-[-0.06em] text-ink dark:text-white/90">₼</span>
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

      <div className="flex items-center justify-between text-[1.05rem] tracking-[-0.03em] text-black/45 dark:text-white/50">
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
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <p className="text-[1.1rem] tracking-[-0.03em] text-black/55 dark:text-white/60">Müddət</p>
        <p className="num text-[2rem] font-semibold tracking-[-0.06em] text-ink dark:text-white/90">
          {value} ay
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {options.map((option) => {
          const isActive = option.termMonths === value;

          return (
            <button
              key={option.termMonths}
              type="button"
              onClick={() => onChange(option.termMonths)}
              className={`rounded-card border px-4 py-4 text-left transition ${
                isActive
                  ? "border-brand-green bg-brand-green text-white shadow-[0_16px_32px_rgba(22,163,74,0.22)]"
                  : "border-emerald-100 dark:border-emerald-500/25 bg-emerald-50/75 dark:bg-emerald-500/10 text-black/70 dark:text-white/75 hover:-translate-y-0.5 hover:border-brand-green/45"
              }`}
            >
              <div className="text-sm font-medium tracking-[-0.02em]">
                {option.termMonths} ay
              </div>
              <div className={`num mt-2 text-lg font-semibold tracking-[-0.04em] ${isActive ? "text-white" : "text-brand-green-deep dark:text-emerald-400"}`}>
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
      <span className="text-sm font-medium tracking-[-0.01em] text-black/70 dark:text-white/75">{label}</span>
      <span className="num text-base font-semibold tracking-[-0.03em] text-black dark:text-white/90">
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
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.82fr)] lg:gap-8">
      <div className="rounded-hero border border-white/70 dark:border-white/10 bg-white/70 dark:bg-white/10 p-6 shadow-[0_24px_60px_rgba(74,150,102,0.08)] backdrop-blur-xl sm:p-8">
        <div className="space-y-8">
          <AmountField value={amount} onChange={setAmount} />
          <PeriodPicker options={options} value={effectivePeriod} onChange={setPeriod} />

          <div className="rounded-3xl border border-amber-100 dark:border-amber-500/25 bg-[linear-gradient(135deg,rgba(255,251,235,0.95),rgba(240,253,244,0.8))] p-5 dark:bg-none dark:bg-amber-500/10 sm:p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-green-deep/75 dark:text-emerald-400/75">
              Qeyd
            </p>
            <p className="mt-3 text-[1rem] leading-7 tracking-[-0.02em] text-black/55 dark:text-white/60">
              Depozit qazancı müddətin sonunda hesablanır. Vaxtından əvvəl çıxarış
              zamanı faiz tətbiq olunmur.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-hero bg-[linear-gradient(160deg,#16a34a_0%,#15803d_100%)] p-8 text-white shadow-[0_30px_70px_rgba(22,163,74,0.24)] sm:p-10">
        <p className="text-center text-[1.15rem] font-medium tracking-[-0.03em] text-white/90">
          Müddət sonu məbləğ
        </p>
        <p className="num mt-5 text-center text-[clamp(3rem,6vw,4.6rem)] font-black tracking-[-0.08em]">
          {formatMoney(maturityAmount)}
        </p>

        <div className="mt-8 rounded-3xl bg-white dark:bg-white/10 px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_18px_38px_rgba(13,94,47,0.16)] sm:px-6">
          <div className="space-y-4">
            <SummaryRow label="Əsas məbləğ" value={formatMoney(amount)} />
            <SummaryRow label="Qazanc" value={formatMoney(gainAmount)} />
            <SummaryRow label="İllik gəlir" value={formatRate(annualRate)} />
          </div>
        </div>

        <p className="mt-6 text-center text-sm leading-6 tracking-[-0.01em] text-white/75">
          Hesablama illik gəlirin müddətə proporsional bölünməsi ilə aparılır.
        </p>
      </div>
    </div>
  );
}
