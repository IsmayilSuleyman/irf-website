import Link from "next/link";
import { Odometer } from "@/components/Odometer";

// The compact unit-price row under the performance chart: buy/sell quotes
// inline with the Bazar shortcut. The current mid price already shows in
// the ticker strip's İRF Payı tile, so only the two tradeable quotes
// print here.

function Quote({ label, value }: { label: string; value: number | null }) {
  return (
    <span className="flex items-baseline gap-1.5 text-sm">
      <span className="text-black/55 dark:text-white/60">{label}:</span>
      <span className="num font-semibold text-black/85 dark:text-white/90">
        {value != null ? (
          <Odometer value={value} fractionDigits={2} suffix=" ₼" />
        ) : (
          "—"
        )}
      </span>
    </span>
  );
}

export function UnitPriceRow({
  ask,
  bid,
}: {
  ask: number | null;
  bid: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="rounded-lg border border-black/10 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:border-white/10 dark:text-white/50">
        1 payın qiyməti
      </span>
      <Quote label="Alış" value={ask} />
      <Quote label="Satış" value={bid} />
      <Link
        href="/market"
        className="group ml-auto inline-flex items-center gap-1.5 rounded-full border border-brand-green/30 bg-brand-green/5 px-3 py-1.5 text-[11px] font-medium text-brand-green shadow-sm transition hover:bg-brand-green/10 dark:text-emerald-400"
      >
        <span>Bazar</span>
        <span aria-hidden className="transition group-hover:translate-x-0.5">
          →
        </span>
      </Link>
    </div>
  );
}
