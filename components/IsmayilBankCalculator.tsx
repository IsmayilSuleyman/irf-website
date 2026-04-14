"use client";

import { useMemo, useState, type CSSProperties } from "react";

const MIN_AMOUNT = 50;
const MAX_AMOUNT = 500;
const MIN_PERIOD = 1;
const MAX_PERIOD = 12;

const RATE_BY_PERIOD: Record<number, number> = {
  1: 0,
  2: 0,
  3: 0,
  4: 0.5,
  5: 1,
  6: 1.5,
  7: 2.15,
  8: 2.9,
  9: 3.9,
  10: 4.9,
  11: 5.9,
  12: 6.9,
};

const RATE_OPTIONS = Object.entries(RATE_BY_PERIOD).map(([months, annualRate]) => ({
  months: Number(months),
  annualRate,
}));

const MAX_RATE = RATE_OPTIONS[RATE_OPTIONS.length - 1]?.annualRate ?? 0;

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
    minimumFractionDigits: Number.isInteger(rate) ? 0 : rate * 10 === Math.trunc(rate * 10) ? 1 : 2,
    maximumFractionDigits: 2,
  }).format(rate)} %`;
}

function calculateMonthlyPayment(amount: number, period: number, annualRate: number) {
  if (annualRate === 0) {
    return amount / period;
  }

  const monthlyRate = annualRate / 100 / 12;
  return amount * monthlyRate / (1 - Math.pow(1 + monthlyRate, -period));
}

function SliderField({
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
  const progress = `${((value - min) / (max - min)) * 100}%`;

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <p className="text-[1.1rem] tracking-[-0.03em] text-black/56">{label}</p>
        <p className="num text-[2rem] font-semibold tracking-[-0.06em] text-[#111827]">
          {valueLabel}
        </p>
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

      <div className="flex items-center justify-between text-[1.05rem] tracking-[-0.03em] text-black/48">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}

function RateField({ rate }: { rate: number }) {
  const rawProgress = MAX_RATE === 0 ? 0 : (rate / MAX_RATE) * 100;
  const thumbProgress = Math.min(Math.max(rawProgress, 2.2), 97.8);

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <p className="text-[1.1rem] tracking-[-0.03em] text-black/56">Faiz dərəcəsi</p>
        <p className="num text-[2rem] font-semibold tracking-[-0.06em] text-[#111827]">
          {formatRate(rate)}
        </p>
      </div>

      <div className="relative h-8">
        <div className="absolute inset-x-0 top-1/2 h-4 -translate-y-1/2 rounded-full bg-black/8" />
        <div
          className="absolute left-0 top-1/2 h-4 -translate-y-1/2 rounded-full bg-[#2F61D8]"
          style={{ width: `${rawProgress}%` }}
        />
        <div
          className="absolute top-1/2 h-8 w-[14px] -translate-y-1/2 rounded-full border-[4px] border-[#2F61D8] bg-white shadow-[0_10px_22px_rgba(47,97,216,0.16)]"
          style={{ left: `calc(${thumbProgress}% - 7px)` }}
        />
      </div>

      <div className="flex items-center justify-between text-[1.05rem] tracking-[-0.03em] text-black/48">
        <span>{formatRate(0)}</span>
        <span>{formatRate(MAX_RATE)}</span>
      </div>

      <p className="text-sm leading-6 tracking-[-0.01em] text-black/42">
        Faiz dərəcəsi seçdiyiniz müddətə görə avtomatik tətbiq olunur.
      </p>
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
      <span className="text-sm font-medium tracking-[-0.01em] text-[#315CC8]/72">{label}</span>
      <span className="num text-base font-semibold tracking-[-0.03em] text-[#173B95]">
        {value}
      </span>
    </div>
  );
}

export function IsmayilBankCalculator() {
  const [amount, setAmount] = useState(250);
  const [period, setPeriod] = useState(6);

  const annualRate = RATE_BY_PERIOD[period] ?? 0;

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

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.82fr)] lg:gap-8">
        <div className="rounded-[2rem] border border-white/70 bg-white/70 p-6 shadow-[0_24px_60px_rgba(98,126,187,0.08)] backdrop-blur-xl sm:p-8">
          <div className="space-y-8">
            <SliderField
              label="Məbləğ"
              min={MIN_AMOUNT}
              max={MAX_AMOUNT}
              value={amount}
              onChange={setAmount}
              minLabel={formatAmount(MIN_AMOUNT)}
              maxLabel={formatAmount(MAX_AMOUNT)}
              valueLabel={formatAmount(amount)}
            />

            <SliderField
              label="Müddət"
              min={MIN_PERIOD}
              max={MAX_PERIOD}
              value={period}
              onChange={setPeriod}
              minLabel={`${MIN_PERIOD} ay`}
              maxLabel={`${MAX_PERIOD} ay`}
              valueLabel={`${period} ay`}
            />

            <RateField rate={annualRate} />
          </div>
        </div>

        <div className="rounded-[2rem] bg-[linear-gradient(160deg,#2F61D8_0%,#2758D0_60%,#214CBD_100%)] p-8 text-white shadow-[0_30px_70px_rgba(47,97,216,0.28)] sm:p-10">
          <p className="text-center text-[1.15rem] font-medium tracking-[-0.03em] text-white/88">
            Aylıq kredit ödənişi
          </p>
          <p className="num mt-5 text-center text-[clamp(3rem,6vw,4.6rem)] font-black tracking-[-0.08em]">
            {formatMoney(monthlyPayment)}
          </p>

          <div className="mt-8 rounded-[1.5rem] bg-white px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_18px_38px_rgba(23,59,149,0.16)] sm:px-6">
            <div className="space-y-4">
              <SummaryRow label="Ümumi ödəniş" value={formatMoney(totalRepayment)} />
              <SummaryRow label="Ümumi faiz" value={formatMoney(totalInterest)} />
              <SummaryRow label="İllik faiz" value={formatRate(annualRate)} />
            </div>
          </div>

          <p className="mt-6 text-center text-sm leading-6 tracking-[-0.01em] text-white/72">
            İlkin hesablama. Yekun şərtlər müraciət zamanı təsdiqlənir.
          </p>
        </div>
      </div>

      <div className="rounded-[1.8rem] border border-blue-200/60 bg-white/68 p-5 shadow-[0_18px_42px_rgba(73,111,186,0.08)] backdrop-blur-xl sm:p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2F61D8]/80">
          Müddətə görə illik faiz
        </p>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          {RATE_OPTIONS.map((option) => (
            <div
              key={option.months}
              className="flex items-center justify-between rounded-[1rem] border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm tracking-[-0.02em] text-black/58"
            >
              <span>{option.months} ay</span>
              <span className="num font-semibold text-[#1C4DBC]">{formatRate(option.annualRate)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
