import { formatGrouped } from "@/lib/portfolio";
import { Masked } from "@/components/Masked";

// Günün icmalı — the fund view's auto-written daily digest, following
// İsmayıl's base text word for word:
//   "Fondun dəyəri bu gün X.XX% yüksəlib/azalıb.
//    Ticarət günü ərzində ən yaxşı nəticə göstərən hazırda XXXX (X.XX%)
//    olmaqla, ən zəif nəticəni XXXX (X.XX%) göstərib. Fondun ümumi dəyəri
//    XXX AZN artıb/azalıb (X.XX%)."
// The direction lives in the verb, so the title and the value sentence
// show unsigned percentages (colour still carries the tone); the movers
// keep their signs — the day's "best" can be red on a down day. Every
// figure comes from the same server data the hero shows, so the summary
// can never disagree with the numbers around it. It wears the Fond news
// banner's plate: black in both themes, green accents.

const pctAbs = (p: number) =>
  `${(Math.abs(p) * 100).toFixed(2).replace(".", ",")}%`;

const pctSigned = (p: number) =>
  `${p >= 0 ? "+" : "−"}${pctAbs(p)}`;

// Neutral colour for masked amounts — the dots must not leak the sign.
const MASK_TONE = "text-white/40";

const tone = (n: number) => (n >= 0 ? "text-emerald-300" : "text-rose-300");

export type DailySummaryMover = { symbol: string; pct: number };

export function DailySummaryCard({
  dateLabel,
  valueAzn,
  dayAzn,
  best,
  worst,
}: {
  dateLabel: string;
  valueAzn: number;
  /** Fund-wide day change, AZN — the hero's günlük dəyişim figure. */
  dayAzn: number | null;
  best: DailySummaryMover | null;
  worst: DailySummaryMover | null;
}) {
  const dayPct =
    dayAzn != null && valueAzn - dayAzn > 0 ? dayAzn / (valueAzn - dayAzn) : null;

  const title =
    dayPct == null || dayPct === 0 ? (
      <>Fondun dəyəri bu gün dəyişməyib</>
    ) : (
      <>
        Fondun dəyəri bu gün{" "}
        <span className={tone(dayPct)}>{pctAbs(dayPct)}</span>{" "}
        {dayPct >= 0 ? "yüksəlib" : "azalıb"}
      </>
    );

  const moverPct = (m: DailySummaryMover) => (
    <span className={`num ${tone(m.pct)}`}>({pctSigned(m.pct)})</span>
  );

  return (
    <article className="relative overflow-hidden rounded-2xl border border-brand-green/25 bg-[linear-gradient(135deg,#0e1411,#18211b)] p-5 text-white sm:p-6">
      <div
        aria-hidden
        className="absolute -right-10 -top-14 h-40 w-40 rounded-full bg-brand-green/15 blur-2xl"
      />
      <div className="relative">
        <p className="num text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-400/90">
          Günün icmalı · {dateLabel}
        </p>
        <h3 className="mt-2 text-[clamp(1.15rem,2.6vw,1.45rem)] font-black tracking-[-0.03em]">
          {title}
        </h3>
        <p className="mt-2.5 text-[13px] leading-6 text-white/85">
          {best ? (
            worst && worst.symbol !== best.symbol ? (
              <>
                Ticarət günü ərzində ən yaxşı nəticə göstərən hazırda{" "}
                <span className="num font-semibold">{best.symbol}</span>{" "}
                {moverPct(best)} olmaqla, ən zəif nəticəni{" "}
                <span className="num font-semibold">{worst.symbol}</span>{" "}
                {moverPct(worst)} göstərib.{" "}
              </>
            ) : (
              <>
                Ticarət günü ərzində ən yaxşı nəticəni hazırda{" "}
                <span className="num font-semibold">{best.symbol}</span>{" "}
                {moverPct(best)} göstərib.{" "}
              </>
            )
          ) : null}
          {dayAzn != null && dayPct != null ? (
            <>
              Fondun ümumi dəyəri{" "}
              <Masked mask="••••" className={MASK_TONE}>
                <span className="num">
                  {formatGrouped(Math.abs(dayAzn), 2)} AZN
                </span>
              </Masked>{" "}
              {dayAzn >= 0 ? "artıb" : "azalıb"} (
              <span className={`num ${tone(dayPct)}`}>{pctAbs(dayPct)}</span>).
            </>
          ) : null}
        </p>
      </div>
    </article>
  );
}
