import type { ReactNode } from "react";
import { formatAzn, formatUnits } from "@/lib/portfolio";
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
};

type FundProps = {
  variant: "fund";
  holderName: string;
  value: number;
  dayChange: number | null;
  totalChange: number | null;
  toggle?: ReactNode;
  privacyToggle?: ReactNode;
};

const changeTone = (n: number | null) =>
  n == null ? "text-black/45 dark:text-white/50" : n >= 0 ? "text-brand-green dark:text-emerald-400" : "text-brand-red dark:text-red-400";

const changeText = (n: number | null) =>
  n == null ? null : `${n >= 0 ? "+" : ""}${formatAzn(n)}`;

// Neutral colour for masked amounts — the dots must not leak the sign.
const MASK_TONE = "text-black/35 dark:text-white/40";

function Greeting({
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
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-green dark:text-emerald-400">
          Xoş gəldin,
          <span className="hidden sm:inline"> {holderName}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {privacyToggle}
          {toggle}
        </div>
      </div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-green dark:text-emerald-400 sm:hidden">
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
  } = props;

  const dayChangeStr = changeText(dayChange);
  const overallStr = changeText(holdingPnl);

  return (
    <div className="flex flex-col gap-4">
      <Greeting
        holderName={holderName}
        toggle={toggle}
        privacyToggle={privacyToggle}
      />
      <div className="flex items-end gap-4">
        {/* Kept in lockstep with FundHero below — İsmayıl wants the big
            money figure a notch smaller in BOTH dashboard views. */}
        <div
          className="num font-black leading-none tracking-tight"
          style={{ fontSize: "clamp(3.5rem, 11vw, 7rem)" }}
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
}: FundProps) {
  const dayStr = changeText(dayChange);
  const totalStr = changeText(totalChange);

  return (
    <div className="flex flex-col gap-4">
      <Greeting
        holderName={holderName}
        toggle={toggle}
        privacyToggle={privacyToggle}
      />
      <div className="flex items-end gap-4">
        {/* One notch below the personal hero — the whole-fund total reads
            calmer slightly smaller. */}
        <div
          className="num font-black leading-none tracking-tight"
          style={{ fontSize: "clamp(3.5rem, 11vw, 7rem)" }}
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
