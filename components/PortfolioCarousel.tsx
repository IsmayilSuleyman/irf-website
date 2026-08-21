"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, m } from "framer-motion";
import { healthLabel } from "@/lib/momentum";
import { fmtPct } from "@/components/MomentumFactorTable";

// The pie's slot in Fond Portfeli becomes a small carousel: sector pie ⟷
// momentum-strength gauge ⟷ 13W performance against the S&P 500, stepped with
// side arrows or the dots underneath. Slides share the pie's h-72 footprint so
// flipping never shifts the layout.
//
// Copy note: the benchmark is held as the SPY ETF but is named "S&P 500" in
// the UI — shareholders know the index, not the ticker.

const TONE_TEXT = {
  red: "text-brand-red dark:text-red-400",
  amber: "text-amber-600 dark:text-amber-400",
  green: "text-brand-green dark:text-emerald-400",
} as const;

const TONE_PILL = {
  red: "bg-brand-red/15 text-brand-red dark:text-red-400",
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  green: "bg-brand-green/15 text-brand-green dark:text-emerald-400",
} as const;

export function HealthGauge({ health }: { health: number }) {
  const { label, tone } = healthLabel(health);
  const pct = Math.max(0, Math.min(100, health));
  return (
    <div className="flex h-72 w-full flex-col items-center justify-center gap-5 px-8">
      <span className="text-[10px] uppercase tracking-[0.22em] text-black/45 dark:text-white/50">
        Portfelin momentum gücü
      </span>
      <div className="flex items-baseline gap-2.5">
        <span className={`num text-4xl font-semibold ${TONE_TEXT[tone]}`}>
          {health.toFixed(1)}
        </span>
        <span
          className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${TONE_PILL[tone]}`}
        >
          {label}
        </span>
      </div>
      <div className="w-full max-w-[16rem]">
        {/* Band bar: Zəif <50, Orta 50–70, Güclü ≥70, with the portfolio's
            marker on top. */}
        <div className="relative">
          <div className="flex h-2.5 overflow-hidden rounded-full">
            <div className="bg-brand-red/50" style={{ width: "50%" }} />
            <div className="bg-amber-500/50" style={{ width: "20%" }} />
            <div className="bg-brand-green/50" style={{ width: "30%" }} />
          </div>
          <div
            className="absolute -top-1 h-[18px] w-[3px] -translate-x-1/2 rounded-full bg-black/80 dark:bg-white/90"
            style={{ left: `${pct}%` }}
          />
        </div>
        <div className="num relative mt-1.5 h-3.5 text-[9px] text-black/40 dark:text-white/45">
          <span className="absolute left-0">0</span>
          <span className="absolute -translate-x-1/2" style={{ left: "50%" }}>
            50
          </span>
          <span className="absolute -translate-x-1/2" style={{ left: "70%" }}>
            70
          </span>
          <span className="absolute right-0">100</span>
        </div>
      </div>
      <span className="max-w-[16rem] text-center text-[10px] leading-relaxed text-black/40 dark:text-white/45">
        Portfel çəkilərinə görə hesablanmış momentum balı — Zəif &lt;50 · Orta
        50–70 · Güclü ≥70.
      </span>
    </div>
  );
}

export function AlphaCompare({
  portfolioRet,
  spyRet,
}: {
  portfolioRet: number;
  spyRet: number;
}) {
  const alpha = portfolioRet - spyRet;
  const maxAbs = Math.max(Math.abs(portfolioRet), Math.abs(spyRet), 0.0001);
  const bar = (v: number, emphasize: boolean) => (
    <div className="h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
      <div
        className={`h-full rounded-full ${
          v >= 0 ? "bg-brand-green" : "bg-brand-red"
        } ${emphasize ? "" : "opacity-60"}`}
        style={{ width: `${Math.max(3, (Math.abs(v) / maxAbs) * 100)}%` }}
      />
    </div>
  );
  const valueCls = (v: number) =>
    v >= 0 ? TONE_TEXT.green : TONE_TEXT.red;
  return (
    <div className="flex h-72 w-full flex-col items-center justify-center gap-5 px-8">
      <span className="text-[10px] uppercase tracking-[0.22em] text-black/45 dark:text-white/50">
        S&amp;P 500 ilə müqayisə (13 həftə)
      </span>
      <div className="flex items-baseline gap-2.5">
        <span className={`num text-4xl font-semibold ${valueCls(alpha)}`}>
          {fmtPct(alpha)}
        </span>
        <span
          className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
            alpha >= 0 ? TONE_PILL.green : TONE_PILL.red
          }`}
        >
          {alpha >= 0 ? "Üstünlük" : "Geridə"}
        </span>
      </div>
      <div className="flex w-full max-w-[16rem] flex-col gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between text-[11px]">
            <span className="text-black/55 dark:text-white/60">
              Portfel (13 həftə)
            </span>
            <span className={`num font-medium ${valueCls(portfolioRet)}`}>
              {fmtPct(portfolioRet)}
            </span>
          </div>
          {bar(portfolioRet, true)}
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between text-[11px]">
            <span className="text-black/55 dark:text-white/60">
              S&amp;P 500 (13 həftə)
            </span>
            <span className={`num font-medium ${valueCls(spyRet)}`}>
              {fmtPct(spyRet)}
            </span>
          </div>
          {bar(spyRet, false)}
        </div>
      </div>
      <span className="max-w-[16rem] text-center text-[10px] leading-relaxed text-black/40 dark:text-white/45">
        Son 13 həftənin portfel çəkilərinə görə gəliri, S&amp;P 500 ilə
        müqayisədə.
      </span>
    </div>
  );
}

const SLIDE_VARIANTS = {
  enter: (d: number) => ({ opacity: 0, x: 24 * d }),
  center: { opacity: 1, x: 0 },
  exit: (d: number) => ({ opacity: 0, x: -24 * d }),
};

function Arrow({
  side,
  onClick,
  label,
}: {
  side: "left" | "right";
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`absolute top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white/70 text-black/55 backdrop-blur transition hover:text-black/85 dark:border-white/15 dark:bg-black/30 dark:text-white/60 dark:hover:text-white/85 ${
        side === "left" ? "left-0" : "right-0"
      }`}
    >
      <svg
        aria-hidden
        viewBox="0 0 8 12"
        className={`h-3 w-2 fill-none stroke-current ${side === "left" ? "" : "rotate-180"}`}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6.5 1 1.5 6l5 5" />
      </svg>
    </button>
  );
}

export function PortfolioCarousel({
  slides,
}: {
  slides: { key: string; label: string; content: ReactNode }[];
}) {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  if (slides.length === 0) return null;
  if (slides.length === 1) return <>{slides[0].content}</>;

  const active = slides[Math.min(index, slides.length - 1)];
  const go = (delta: number) => {
    setDir(delta > 0 ? 1 : -1);
    setIndex((i) => (i + delta + slides.length) % slides.length);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <AnimatePresence initial={false} mode="wait" custom={dir}>
          <m.div
            key={active.key}
            custom={dir}
            variants={SLIDE_VARIANTS}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {active.content}
          </m.div>
        </AnimatePresence>
        <Arrow side="left" onClick={() => go(-1)} label="Əvvəlki görünüş" />
        <Arrow side="right" onClick={() => go(1)} label="Növbəti görünüş" />
      </div>
      <div className="flex items-center justify-center gap-1.5">
        {slides.map((s, i) => (
          <button
            key={s.key}
            type="button"
            aria-label={s.label}
            aria-current={i === index}
            onClick={() => {
              setDir(i > index ? 1 : -1);
              setIndex(i);
            }}
            className={`h-1.5 rounded-full transition-all ${
              i === index
                ? "w-4 bg-brand-green"
                : "w-1.5 bg-black/15 hover:bg-black/30 dark:bg-white/20 dark:hover:bg-white/35"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
