import type { BankHealth, BankHealthTone } from "@/lib/bankHealth";

// The verdict plate at the top of Ümumbank baxışı — the news-plate look
// (DailySummaryCard's dark card, kept dark in both themes) translated into
// the bank's blue language. People read verdicts; the tiles below are for
// whoever wants to audit the reasons.

const LEVEL_STYLE = {
  saglam: {
    headline: "text-emerald-300",
    badge: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
    glyph: "✓",
  },
  diqqet: {
    headline: "text-amber-300",
    badge: "border-amber-400/40 bg-amber-400/10 text-amber-300",
    glyph: "!",
  },
  gergin: {
    headline: "text-rose-300",
    badge: "border-rose-400/40 bg-rose-400/10 text-rose-300",
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
      className="relative scroll-mt-6 overflow-hidden rounded-2xl border border-bank-blue/25 bg-[linear-gradient(135deg,#0d1220,#141b2e)] p-5 text-white sm:p-6"
    >
      <div
        aria-hidden
        className="absolute -right-10 -top-14 h-40 w-40 rounded-full bg-bank-blue/20 blur-2xl"
      />
      <div className="relative">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="num text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-300/90">
            Bankın vəziyyəti
          </p>
          {updatedLabel ? (
            <p className="text-[11px] font-medium text-white/45">{updatedLabel}</p>
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
              <li key={i} className="flex items-center gap-2.5 text-[13px] leading-5 text-white/85">
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
