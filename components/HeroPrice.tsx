import type { ReactNode } from "react";
import { formatAzn, formatUnits } from "@/lib/portfolio";
import { Odometer } from "@/components/Odometer";

type PersonalProps = {
  variant?: "personal";
  holderName: string;
  holdingValue: number;
  holdingPnl: number | null;
  dayChange: number | null;
  units: number;
  avgBuyPrice: number | null;
  toggle?: ReactNode;
};

type FundProps = {
  variant: "fund";
  holderName: string;
  value: number;
  dayChange: number | null;
  totalChange: number | null;
  toggle?: ReactNode;
};

const changeTone = (n: number | null) =>
  n == null ? "text-black/35" : n >= 0 ? "text-brand-green" : "text-brand-red";

const changeText = (n: number | null) =>
  n == null ? null : `${n >= 0 ? "+" : ""}${formatAzn(n)}`;

function Greeting({
  holderName,
  toggle,
}: {
  holderName: string;
  toggle?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-green">
        Xoş gəldin, {holderName}
      </div>
      {toggle}
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
  } = props;

  const dayChangeStr = changeText(dayChange);
  const overallStr = changeText(holdingPnl);

  return (
    <div className="flex flex-col gap-4">
      <Greeting holderName={holderName} toggle={toggle} />
      <div className="flex items-end gap-4">
        <div
          className="num font-black leading-none tracking-tight"
          style={{ fontSize: "clamp(3.75rem, 12vw, 7.5rem)" }}
        >
          <Odometer value={holdingValue} fractionDigits={2} suffix="₼" />
        </div>
      </div>
      <div className="flex flex-col gap-1 text-xs text-black/50">
        <div>
          {dayChangeStr ? (
            <>
              günlük dəyişim{" "}
              <span className={changeTone(dayChange)}>{dayChangeStr}</span>
            </>
          ) : null}
          {dayChangeStr && overallStr ? " · " : null}
          {overallStr ? (
            <>
              ümumi dəyişim{" "}
              <span className={changeTone(holdingPnl)}>{overallStr}</span>
            </>
          ) : null}
        </div>
        <div>
          {formatUnits(units)} pay · ortalama alış qiyməti{" "}
          <span className="text-black/75">
            {avgBuyPrice != null ? formatAzn(avgBuyPrice) : "N/A"}
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
}: FundProps) {
  const dayStr = changeText(dayChange);
  const totalStr = changeText(totalChange);

  return (
    <div className="flex flex-col gap-4">
      <Greeting holderName={holderName} toggle={toggle} />
      <div className="flex items-end gap-4">
        <div
          className="num font-black leading-none tracking-tight"
          style={{ fontSize: "clamp(3.75rem, 12vw, 7.5rem)" }}
        >
          <Odometer value={value} fractionDigits={2} suffix="₼" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-black/50">
        {dayStr ? (
          <span>
            günlük dəyişim{" "}
            <span className={changeTone(dayChange)}>{dayStr}</span>
          </span>
        ) : null}
        {totalStr ? (
          <span>
            ümumi dəyişim{" "}
            <span className={changeTone(totalChange)}>{totalStr}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}
