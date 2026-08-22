import type { ReactNode } from "react";
import { formatAzn } from "@/lib/portfolio";
import { Masked } from "@/components/Masked";
import type { ExtendedMode } from "@/lib/extendedPortfolio";

// Günün icmalı — the fund view's auto-written daily digest. Every line is
// composed server-side from the same figures the hero and the tiles show,
// so the summary can never disagree with the numbers around it. It wears
// the Fond news banner's plate: black in both themes, the fund speaking
// through the green accents.

const fmtPct = (p: number) =>
  `${p >= 0 ? "+" : "−"}${(Math.abs(p) * 100).toFixed(2).replace(".", ",")}%`;

const fmtSignedAzn = (n: number) =>
  `${n >= 0 ? "+" : "−"}${formatAzn(Math.abs(n))}`;

// Neutral colour for masked amounts — the dots must not leak the sign.
const MASK_TONE = "text-white/40";

const tone = (n: number) => (n >= 0 ? "text-emerald-300" : "text-rose-300");

const EXT_LABEL: Record<ExtendedMode, string> = {
  pre: "Premarket seansında",
  post: "After-market seansında",
  overnight: "Gecə seansında",
};

function Amount({ value, masked = true }: { value: string; masked?: boolean }) {
  const node = <span className="num">{value}</span>;
  if (!masked) return node;
  return (
    <Masked mask="••••" className={MASK_TONE}>
      {node}
    </Masked>
  );
}

export type DailySummaryMover = { symbol: string; pct: number };

export function DailySummaryCard({
  dateLabel,
  valueAzn,
  dayAzn,
  unitPriceAzn,
  unitDayAzn,
  unitDayPct,
  best,
  worst,
  extended,
  vaultValueAzn,
  vaultDayAzn,
}: {
  dateLabel: string;
  valueAzn: number;
  /** Fund-wide day change, AZN — the hero's günlük dəyişim figure. */
  dayAzn: number | null;
  unitPriceAzn: number;
  unitDayAzn: number | null;
  unitDayPct: number | null;
  best: DailySummaryMover | null;
  worst: DailySummaryMover | null;
  extended: { mode: ExtendedMode; changePct: number; deltaAzn: number } | null;
  vaultValueAzn: number | null;
  vaultDayAzn: number | null;
}) {
  const dayPct =
    dayAzn != null && valueAzn - dayAzn > 0 ? dayAzn / (valueAzn - dayAzn) : null;

  // The headline states the day's direction; the tiny-move band reads as
  // flat so the title never shouts about a ±0,01% wiggle.
  const title =
    dayPct == null || Math.abs(dayPct) < 0.0005 ? (
      <>Fond bu gün sabitdir</>
    ) : (
      <>
        Fond bu gün{" "}
        <span className={tone(dayPct)}>{fmtPct(dayPct)}</span>{" "}
        {dayPct >= 0 ? "yüksəlib" : "geriləyib"}
      </>
    );

  const lines: ReactNode[] = [];

  lines.push(
    <>
      Fondun ümumi dəyəri <Amount value={formatAzn(valueAzn)} />
      {dayAzn != null ? (
        <>
          {" "}
          — dünənki qiymətə nəzərən{" "}
          <Amount value={fmtSignedAzn(dayAzn)} />
          {dayPct != null ? (
            <>
              {" "}
              (<span className={`num ${tone(dayPct)}`}>{fmtPct(dayPct)}</span>)
            </>
          ) : null}
        </>
      ) : null}
      .
    </>,
  );

  // The pay price is the same public number for every holder — never masked.
  lines.push(
    <>
      1 payın qiyməti <Amount masked={false} value={formatAzn(unitPriceAzn)} />
      {unitDayAzn != null && unitDayPct != null ? (
        <>
          {" "}
          (
          <span className={`num ${tone(unitDayAzn)}`}>
            {fmtSignedAzn(unitDayAzn)} · {fmtPct(unitDayPct)}
          </span>
          )
        </>
      ) : null}
      .
    </>,
  );

  if (best) {
    lines.push(
      <>
        Portfeldə günün lideri{" "}
        <span className="num font-semibold">{best.symbol}</span>{" "}
        <span className={`num ${tone(best.pct)}`}>({fmtPct(best.pct)})</span>
        {worst && worst.symbol !== best.symbol ? (
          <>
            , ən zəif nəticə{" "}
            <span className="num font-semibold">{worst.symbol}</span>{" "}
            <span className={`num ${tone(worst.pct)}`}>
              ({fmtPct(worst.pct)})
            </span>
          </>
        ) : null}
        .
      </>,
    );
  }

  if (extended) {
    lines.push(
      <>
        {EXT_LABEL[extended.mode]} portfel{" "}
        <span className={`num ${tone(extended.changePct)}`}>
          {fmtPct(extended.changePct)}
        </span>{" "}
        (<Amount value={fmtSignedAzn(extended.deltaAzn)} />) hərəkət edib.
      </>,
    );
  }

  if (vaultValueAzn != null && vaultValueAzn > 0) {
    lines.push(
      <>
        Seyfdəki digər aktivlər <Amount value={formatAzn(vaultValueAzn)} />
        {vaultDayAzn != null ? (
          <>
            {" "}
            təşkil edir — bu gün <Amount value={fmtSignedAzn(vaultDayAzn)} />
          </>
        ) : (
          <> təşkil edir</>
        )}
        .
      </>,
    );
  }

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
        <div className="mt-2.5 flex flex-col gap-1 text-[13px] leading-6 text-white/85">
          {lines.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      </div>
    </article>
  );
}
