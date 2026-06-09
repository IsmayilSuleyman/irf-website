"use client";

import { formatGrouped } from "@/lib/portfolio";

type Props = {
  value: number;
  fractionDigits?: number;
  suffix?: string;
  className?: string;
};

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export function Odometer({
  value,
  fractionDigits = 2,
  suffix,
  className = "",
}: Props) {
  const safe = Number.isFinite(value) ? value : 0;
  const sign = safe < 0 ? "-" : "";
  // House AZN style: "." thousands separator, "," decimal (1.234,56).
  const formatted = formatGrouped(Math.abs(safe), fractionDigits);
  const chars = formatted.split("");

  return (
    <span
      className={`inline-flex items-baseline ${className}`}
      aria-label={`${sign}${formatted}${suffix ?? ""}`}
    >
      {sign && <span aria-hidden="true">{sign}</span>}
      {chars.map((ch, i) => {
        const posFromEnd = chars.length - 1 - i;
        const key = `p${posFromEnd}`;
        if (/\d/.test(ch)) {
          return <Digit key={key} value={Number(ch)} />;
        }
        return (
          <span key={key} aria-hidden="true">
            {ch}
          </span>
        );
      })}
      {suffix && <span aria-hidden="true">{suffix}</span>}
    </span>
  );
}

function Digit({ value }: { value: number }) {
  return (
    <span
      aria-hidden="true"
      className="relative inline-block overflow-hidden"
      style={{ height: "1em", lineHeight: 1, verticalAlign: "baseline" }}
    >
      <span style={{ visibility: "hidden" }}>0</span>
      <span
        className="absolute left-0 top-0"
        style={{
          transform: `translateY(-${value}em)`,
          transition: "transform 650ms cubic-bezier(0.22, 1, 0.36, 1)",
          willChange: "transform",
        }}
      >
        {DIGITS.map((n) => (
          <span
            key={n}
            className="block"
            style={{ height: "1em", lineHeight: 1 }}
          >
            {n}
          </span>
        ))}
      </span>
    </span>
  );
}
