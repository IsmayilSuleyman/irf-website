import type { PeriodChange, PeriodChanges } from "@/lib/priceHistory";

export function IndicatorsCard({ changes }: { changes: PeriodChanges }) {
  return (
    <div className="glass flex flex-col gap-6 p-6">
      <div className="text-[10px] uppercase tracking-[0.22em] text-brand-green/80">
        Göstəricilər
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-black/[0.06]">
        <Indicator change={changes.w1} label="1 həftə" />
        <Indicator change={changes.m1} label="1 ay" />
        <Indicator change={changes.m3} label="3 ay" />
        <Indicator change={changes.y1} label="1 il" />
      </div>
    </div>
  );
}

function Indicator({
  change,
  label,
}: {
  change: PeriodChange;
  label: string;
}) {
  const { pct, pastPrice } = change;

  const isNull = pct == null;
  const isPositive = !isNull && pct >= 0;

  const toneText = isNull
    ? "text-black/30"
    : isPositive
      ? "text-brand-green"
      : "text-brand-red";

  return (
    <div className="flex flex-col items-start gap-2 px-4 first:pl-0 last:pr-0">
      <div className="text-[10px] uppercase tracking-[0.12em] whitespace-nowrap text-black/40">
        {label}
      </div>

      <div className={`num flex items-baseline gap-0.5 ${toneText}`}>
        {isNull ? (
          <span className="text-xl font-semibold leading-none">—</span>
        ) : (
          <>
            <span className="text-xs leading-none">
              {isPositive ? "↑" : "↓"}
            </span>
            <span className="text-xl font-semibold leading-none tracking-tight">
              {Math.abs(pct * 100).toFixed(0)}%
            </span>
          </>
        )}
      </div>

      <div className="num text-xs text-black/45">
        {pastPrice != null ? `${pastPrice.toFixed(2)} ₼ əvvəl` : "—"}
      </div>
    </div>
  );
}
