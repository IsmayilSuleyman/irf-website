import type { BankHealth, BankHealthTone } from "@/lib/bankHealth";

// The verdict plate at the top of Ümumbank baxışı — the news-plate look
// (DailySummaryCard's card: pale in light mode, dark in dark) translated
// into the bank's blue language. People read verdicts; the tiles below are for
// whoever wants to audit the reasons.

const LEVEL_STYLE = {
  saglam: {
    headline: "text-emerald-700 dark:text-emerald-300",
    badge: "border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-300",
    glyph: "✓",
  },
  diqqet: {
    headline: "text-amber-600 dark:text-amber-300",
    badge: "border-amber-500/40 bg-amber-400/15 text-amber-600 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-300",
    glyph: "!",
  },
  gergin: {
    headline: "text-rose-600 dark:text-rose-300",
    badge: "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:border-rose-400/40 dark:bg-rose-400/10 dark:text-rose-300",
    glyph: "✕",
  },
} as const;

const DOT_TONE: Record<BankHealthTone, string> = {
  good: "bg-emerald-400",
  warn: "bg-amber-400",
  bad: "bg-rose-400",
};

export function BankHealthBanner({
  health,
  updatedLabel,
}: {
  health: BankHealth;
  updatedLabel?: string;
}) {
  const style = LEVEL_STYLE[health.level];
  return (
    <section
      id="veziyyet"
      className="relative scroll-mt-6 overflow-hidden rounded-2xl border border-bank-blue/25 bg-[linear-gradient(135deg,#f4f7fd,#e5ebf8)] p-5 text-black/85 dark:bg-[linear-gradient(135deg,#0d1220,#141b2e)] dark:text-white sm:p-6"
    >
      <div
        aria-hidden
        className="absolute -right-10 -top-14 h-40 w-40 rounded-full bg-bank-blue/10 blur-2xl dark:bg-bank-blue/20"
      />
      <div className="relative">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="num text-[10px] font-semibold uppercase tracking-[0.22em] text-bank-blue dark:text-blue-300/90">
            Bankın vəziyyəti
          </p>
          {updatedLabel ? (
            <p className="text-[11px] font-medium text-black/45 dark:text-white/45">{updatedLabel}</p>
          ) : null}
        </div>
        <div className="mt-2 flex items-center gap-3">
          <span
            aria-hidden
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[15px] font-black ${style.badge}`}
          >
            {style.glyph}
          </span>
          <h2
            className={`text-[clamp(1.3rem,3vw,1.6rem)] font-black tracking-[-0.03em] ${style.headline}`}
          >
            {health.title}
          </h2>
        </div>
        {health.reasons.length > 0 ? (
          <ul className="mt-3.5 space-y-1.5">
            {health.reasons.map((r, i) => (
              <li key={i} className="flex items-center gap-2.5 text-[13px] leading-5 text-black/70 dark:text-white/85">
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_TONE[r.tone]}`}
                />
                {r.text}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
