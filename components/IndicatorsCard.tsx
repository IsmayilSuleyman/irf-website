import type { PeriodChange, PeriodChanges } from "@/lib/priceHistory";

export function IndicatorsCard({ changes }: { changes: PeriodChanges }) {
  return (
    <div className="glass flex flex-col gap-5 p-6">
      <div className="text-[10px] uppercase tracking-[0.22em] text-brand-green/80">
        Göstəricilər
      </div>
      <div className="grid grid-cols-4 divide-x divide-black/[0.06]">
        <Indicator change={changes.w1} label="1 həftə" sublabel="əvvəl" />
        <Indicator change={changes.m1} label="1 ay" sublabel="əvvəl" />
        <Indicator change={changes.m3} label="3 ay" sublabel="əvvəl" />
        <Indicator change={changes.y1} label="1 il" sublabel="əvvəl" />
      </div>
    </div>
  );
}

function Indicator({
  change,
  label,
  sublabel,
}: {
  change: PeriodChange;
  label: string;
  sublabel: string;
}) {
  const { pct, pastPrice } = change;

  const isNull = pct == null;
  const isPositive = !isNull && pct >= 0;

  const toneBg = isNull
    ? "bg-black/5"
    : isPositive
      ? "bg-brand-green/10"
      : "bg-brand-red/10";

  const toneText = isNull
    ? "text-black/40"
    : isPositive
      ? "text-brand-green"
      : "text-brand-red";

  const pctText = isNull
    ? "—"
    : `${isPositive ? "+" : ""}${(pct * 100).toFixed(0)}%`;

  return (
    <div className="flex flex-col items-start gap-2 px-4 first:pl-0 last:pr-0">
      {/* pill badge — larger text */}
      <span
        className={`inline-flex items-center rounded-full px-3 py-1 text-lg font-bold ${toneBg} ${toneText}`}
      >
        {pctText}
      </span>

      {/* past price */}
      <div className="num text-xs font-medium text-black/55">
        {pastPrice != null ? `${pastPrice.toFixed(2)} ₼` : "—"}
      </div>

      {/* period label + bracket clarification */}
      <div className="text-[10px] uppercase tracking-[0.18em] text-black/35">
        {label}{" "}
        <span className="normal-case tracking-normal text-black/25">
          {sublabel}
        </span>
      </div>
    </div>
  );
}
