import type { ReactNode } from "react";
import { formatAzn, formatGroupedTrim, formatUnits } from "@/lib/portfolio";
import { Odometer } from "@/components/Odometer";
import { Masked } from "@/components/Masked";

type PersonalProps = {
  variant?: "personal";
  holderName: string;
  holdingValue: number;
  holdingPnl: number | null;
  dayChange: number | null;
  units: number;
  avgBuyPrice: number | null;
  toggle?: ReactNode;
  privacyToggle?: ReactNode;
  showGreeting?: boolean;
};

type FundProps = {
  variant: "fund";
  holderName: string;
  value: number;
  dayChange: number | null;
  totalChange: number | null;
  toggle?: ReactNode;
  privacyToggle?: ReactNode;
  showGreeting?: boolean;
};

const changeTone = (n: number | null) =>
  n == null ? "text-black/45 dark:text-white/50" : n >= 0 ? "text-brand-green dark:text-emerald-400" : "text-brand-red dark:text-red-400";

const changeText = (n: number | null) =>
  n == null ? null : `${n >= 0 ? "+" : ""}${formatAzn(n)}`;

// Neutral colour for masked amounts — the dots must not leak the sign.
const MASK_TONE = "text-black/35 dark:text-white/40";

export function Greeting({
  holderName,
  toggle,
  privacyToggle,
}: {
  holderName: string;
  toggle?: ReactNode;
  privacyToggle?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {/* Row 1: greeting + right-corner controls (eye + toggle in one cluster,
          so the eye adds no extra row height). On mobile the name drops to its
          own row below (so it never truncates); on desktop it stays inline. */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-green dark:text-emerald-400">
          Xoş gəldin,
          <span className="hero-name hidden text-[13px] sm:inline">
            {" "}
            {holderName}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {privacyToggle}
          {toggle}
        </div>
      </div>
      <div className="hero-name text-[13px] font-semibold uppercase tracking-[0.22em] sm:hidden">
        {holderName}
      </div>
    </div>
  );
}

export function HeroPrice(props: PersonalProps | FundProps) {
  if (props.variant === "fund") {
    return <FundHero {...props} />;
  }

  const {
    holderName,
    holdingValue,
    holdingPnl,
    dayChange,
    units,
    avgBuyPrice,
    toggle,
    privacyToggle,
    showGreeting = true,
  } = props;

  const dayChangeStr = changeText(dayChange);
  const overallStr = changeText(holdingPnl);

  return (
    <div className="flex flex-col gap-4">
      {showGreeting && (
        <Greeting
          holderName={holderName}
          toggle={toggle}
          privacyToggle={privacyToggle}
        />
      )}
      <div className="flex items-end gap-4">
        {/* Kept in lockstep with FundHero below — İsmayıl wants the big
            money figure a notch smaller in BOTH dashboard views. */}
        <div
          className="num font-black leading-none tracking-tight"
          style={{ fontSize: "clamp(3rem, 9.35vw, 5.95rem)" }}
        >
          <Masked mask="••••">
            <Odometer value={holdingValue} fractionDigits={2} suffix="₼" />
          </Masked>
        </div>
      </div>
      <div className="flex flex-col gap-1 text-xs text-black/45 dark:text-white/50">
        <div>
          {dayChangeStr ? (
            <>
              günlük dəyişim{" "}
              <Masked mask="••••" className={MASK_TONE}>
                <span className={changeTone(dayChange)}>{dayChangeStr}</span>
              </Masked>
            </>
          ) : null}
          {dayChangeStr && overallStr ? " · " : null}
          {overallStr ? (
            <>
              ümumi dəyişim{" "}
              <Masked mask="••••" className={MASK_TONE}>
                <span className={changeTone(holdingPnl)}>{overallStr}</span>
              </Masked>
            </>
          ) : null}
        </div>
        <div>
          <Masked mask="••">{formatUnits(units)}</Masked> pay · ortalama alış qiyməti{" "}
          <span className="text-black/70 dark:text-white/75">
            <Masked mask="••••">
              {avgBuyPrice != null ? formatAzn(avgBuyPrice) : "N/A"}
            </Masked>
          </span>
        </div>
      </div>
    </div>
  );
}

function FundHero({
  holderName,
  value,
  dayChange,
  totalChange,
  toggle,
  privacyToggle,
  showGreeting = true,
}: FundProps) {
  const dayStr = changeText(dayChange);
  const totalStr = changeText(totalChange);

  return (
    <div className="flex flex-col gap-4">
      {showGreeting && (
        <Greeting
          holderName={holderName}
          toggle={toggle}
          privacyToggle={privacyToggle}
        />
      )}
      <div className="flex items-end gap-4">
        {/* One notch below the personal hero — the whole-fund total reads
            calmer slightly smaller. */}
        <div
          className="num font-black leading-none tracking-tight"
          style={{ fontSize: "clamp(3rem, 9.35vw, 5.95rem)" }}
        >
          <Masked mask="••••">
            <Odometer value={value} fractionDigits={2} suffix="₼" />
          </Masked>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-black/45 dark:text-white/50">
        {dayStr ? (
          <span>
            günlük dəyişim{" "}
            <Masked mask="••••" className={MASK_TONE}>
              <span className={changeTone(dayChange)}>{dayStr}</span>
            </Masked>
          </span>
        ) : null}
        {totalStr ? (
          <span>
            ümumi dəyişim{" "}
            <Masked mask="••••" className={MASK_TONE}>
              <span className={changeTone(totalChange)}>{totalStr}</span>
            </Masked>
          </span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The Yahoo-style summary that sits inside the performance chart card
 * (personal view): the headline figure, its day/total change with
 * percentages, and the units line. Percentages derive from the value
 * itself so they can never disagree with the ₼ figures beside them; they
 * stay visible in hide-amounts mode like every other return in the app.
 * Value mode shows the personal holding (masked in hide-amounts mode);
 * price mode passes masked=false — the unit price is the same public
 * number for every holder.
 */
export function ChartSummary({
  value,
  dayChange,
  totalChange,
  units,
  avgBuyPrice,
  masked = true,
  totalLabel = "ümumi fərq",
  action,
}: {
  value: number;
  dayChange: number | null;
  totalChange: number | null;
  units: number;
  avgBuyPrice: number | null;
  masked?: boolean;
  /** Second line's label — "ümumi fərq" by default, "son 3 ayda" in price mode. */
  totalLabel?: string;
  /** Control docked at the card's right edge beside the headline (the hide-amounts eye). */
  action?: ReactNode;
}) {
  const line = (amount: number | null, label: string) => {
    if (amount == null) return null;
    const base = value - amount;
    const pct = base > 0 ? amount / base : null;
    const amountNode = (
      <span className={changeTone(amount)}>{changeText(amount)}</span>
    );
    return (
      <div className="num text-xs font-medium">
        {masked ? (
          <Masked mask="••••" className={MASK_TONE}>
            {amountNode}
          </Masked>
        ) : (
          amountNode
        )}
        {pct != null ? (
          <span className={changeTone(amount)}>
            {" "}
            ({pct >= 0 ? "+" : "-"}
            {formatGroupedTrim(Math.abs(pct) * 100, 2)}%)
          </span>
        ) : null}{" "}
        <span className="font-normal text-black/55 dark:text-white/60">
          {label}
        </span>
      </div>
    );
  };

  const headline = <Odometer value={value} fractionDigits={2} suffix="₼" />;

  return (
    <div className="mb-5 flex flex-col gap-2">
      <div
        className="num font-black leading-none tracking-tight"
        style={{ fontSize: "clamp(2.34rem, 6.8vw, 3.4rem)" }}
      >
        {masked ? <Masked mask="••••">{headline}</Masked> : headline}
      </div>
      {/* The badge + eye cluster rides beside the change rows, top-aligned
          with the "bu gün" line — İsmayıl's pick over shrinking the figure
          to make room next to it. */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          {line(dayChange, "bu gün")}
          {line(totalChange, totalLabel)}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="text-xs text-black/45 dark:text-white/50">
        <Masked mask="••">{formatUnits(units)}</Masked> pay · ortalama alış
        qiyməti{" "}
        <span className="text-black/70 dark:text-white/75">
          <Masked mask="••••">
            {avgBuyPrice != null ? formatAzn(avgBuyPrice) : "N/A"}
          </Masked>
        </span>
      </div>
    </div>
  );
}
