"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

const MIN_AMOUNT = 50;
const MAX_AMOUNT = 2000;

const PERIOD_OPTIONS = [
  { months: 3, annualRate: 10 },
  { months: 6, annualRate: 12 },
  { months: 9, annualRate: 14 },
  { months: 12, annualRate: 16 },
] as const;

function formatAmount(value: number) {
  return `${new Intl.NumberFormat("az-AZ", {
    maximumFractionDigits: 0,
  }).format(value)} ₼`;
}

function formatMoney(value: number) {
  return `${new Intl.NumberFormat("az-AZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ₼`;
}

function formatRate(rate: number) {
  return `${new Intl.NumberFormat("az-AZ", {
    maximumFractionDigits: 0,
  }).format(rate)} %`;
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
        <p className="text-[1.1rem] tracking-[-0.03em] text-black/56">Məbləğ</p>
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
            className="num w-[5ch] bg-transparent text-right text-[2rem] font-semibold tracking-[-0.06em] text-[#111827] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus:border-b-2 focus:border-blue-500"
          />
          <span className="num text-[2rem] font-semibold tracking-[-0.06em] text-[#111827]">₼</span>
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

      <div className="flex items-center justify-between text-[1.05rem] tracking-[-0.03em] text-black/48">
        <span>{formatAmount(MIN_AMOUNT)}</span>
        <span>{formatAmount(MAX_AMOUNT)}</span>
      </div>
    </div>
  );
}

function PeriodPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <p className="text-[1.1rem] tracking-[-0.03em] text-black/56">Müddət</p>
        <p className="num text-[2rem] font-semibold tracking-[-0.06em] text-[#111827]">
          {value} ay
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PERIOD_OPTIONS.map((option) => {
          const isActive = option.months === value;

          return (
            <button
              key={option.months}
              type="button"
              onClick={() => onChange(option.months)}
              className={`rounded-[1.2rem] border px-4 py-4 text-left transition ${
                isActive
                  ? "border-[#18A957] bg-[#18A957] text-white shadow-[0_16px_32px_rgba(24,169,87,0.22)]"
                  : "border-emerald-100 bg-emerald-50/75 text-black/68 hover:-translate-y-0.5 hover:border-[#7FD7A6]"
              }`}
            >
              <div className="text-sm font-medium tracking-[-0.02em]">
                {option.months} ay
              </div>
              <div className={`num mt-2 text-lg font-semibold tracking-[-0.04em] ${isActive ? "text-white" : "text-[#148C49]"}`}>
                {formatRate(option.annualRate)}
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
      <span className="text-sm font-medium tracking-[-0.01em] text-black/70">{label}</span>
      <span className="num text-base font-semibold tracking-[-0.03em] text-black">
        {value}
      </span>
    </div>
  );
}

export function IsmayilBankDepositCalculator() {
  const [amount, setAmount] = useState(500);
  const [period, setPeriod] = useState(6);

  const selectedOption =
    PERIOD_OPTIONS.find((option) => option.months === period) ?? PERIOD_OPTIONS[1];

  const { annualRate } = selectedOption;

  const { maturityAmount, gainAmount } = useMemo(() => {
    const gain = amount * (annualRate / 100) * (period / 12);

    return {
      gainAmount: gain,
      maturityAmount: amount + gain,
    };
  }, [amount, annualRate, period]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.82fr)] lg:gap-8">
      <div className="rounded-[2rem] border border-white/70 bg-white/70 p-6 shadow-[0_24px_60px_rgba(74,150,102,0.08)] backdrop-blur-xl sm:p-8">
        <div className="space-y-8">
          <AmountField value={amount} onChange={setAmount} />
          <PeriodPicker value={period} onChange={setPeriod} />

          <div className="rounded-[1.5rem] border border-amber-100 bg-[linear-gradient(135deg,rgba(255,251,235,0.95),rgba(240,253,244,0.8))] p-5 sm:p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.15em] text-[#148C49]/78">
              Qeyd
            </p>
            <p className="mt-3 text-[1rem] leading-7 tracking-[-0.02em] text-black/58">
              Depozit qazancı müddətin sonunda hesablanır. Vaxtından əvvəl çıxarış
              zamanı faiz tətbiq olunmur.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-[2rem] bg-[linear-gradient(160deg,#18A957_0%,#15954D_56%,#0F7D3F_100%)] p-8 text-white shadow-[0_30px_70px_rgba(24,169,87,0.24)] sm:p-10">
        <p className="text-center text-[1.15rem] font-medium tracking-[-0.03em] text-white/88">
          Müddət sonu məbləğ
        </p>
        <p className="num mt-5 text-center text-[clamp(3rem,6vw,4.6rem)] font-black tracking-[-0.08em]">
          {formatMoney(maturityAmount)}
        </p>

        <div className="mt-8 rounded-[1.5rem] bg-white px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_18px_38px_rgba(13,94,47,0.16)] sm:px-6">
          <div className="space-y-4">
            <SummaryRow label="Əsas məbləğ" value={formatMoney(amount)} />
            <SummaryRow label="Qazanc" value={formatMoney(gainAmount)} />
            <SummaryRow label="İllik gəlir" value={formatRate(annualRate)} />
          </div>
        </div>

        <p className="mt-6 text-center text-sm leading-6 tracking-[-0.01em] text-white/78">
          Hesablama illik gəlirin müddətə proporsional bölünməsi ilə aparılır.
        </p>
      </div>
    </div>
  );
}
