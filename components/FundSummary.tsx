import { formatAzn, formatPct } from "@/lib/portfolio";
import { PeriodIndicators } from "@/components/IndicatorsCard";
import type { PeriodChanges } from "@/lib/priceHistory";

/**
 * Unified fund-overview card (personal view). Replaces three separate stat
 * cards with one coherent window in two zones:
 *   • top  — the two headline figures as a pair: Ümumi dəyəri (gross) and
 *            Xalis dəyəri (net), split by a vertical divider on wide screens;
 *   • below a horizontal divider — Göstəricilər (performance over time).
 */
export function FundSummary({
  totalCapital,
  totalCostBasis,
  netCapital,
  changes,
}: {
  totalCapital: number;
  totalCostBasis: number;
  netCapital: number;
  changes: PeriodChanges;
}) {
  const gain = totalCapital - totalCostBasis;
  const gainPct = totalCostBasis > 0 ? gain / totalCostBasis : 0;
  const gainTone =
    gain > 0
      ? "text-brand-green"
      : gain < 0
        ? "text-brand-red"
        : "text-black/55";
  const sign = gain > 0 ? "+" : "";

  return (
    <div className="glass flex flex-col p-6 sm:p-8">
      {/* Values — gross + net */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-0 sm:divide-x sm:divide-black/[0.06]">
        <div className="flex flex-col gap-2 sm:pr-8">
          <div className="text-[10px] uppercase tracking-[0.22em] text-brand-green/80">
            Ümumi dəyəri
          </div>
          <div className="num text-4xl font-bold text-black md:text-5xl">
            {formatAzn(totalCapital)}
          </div>
          {totalCostBasis > 0 && (
            <div className="flex flex-col gap-0.5 text-xs text-black/55">
              <div>Maya dəyəri: {formatAzn(totalCostBasis)}</div>
              <div className={gainTone}>
                {sign}
                {formatAzn(gain)} ({sign}
                {formatPct(gainPct)})
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:pl-8">
          <div className="text-[10px] uppercase tracking-[0.22em] text-brand-green/80">
            Xalis dəyəri
          </div>
          <div className="num text-4xl font-bold text-black md:text-5xl">
            {formatAzn(netCapital)}
          </div>
          <div className="max-w-xs text-xs leading-snug text-black/45">
            Bütün borclar çıxılandan sonrakı nəticə.
          </div>
        </div>
      </div>

      {/* Performance */}
      <div className="mt-6 flex flex-col gap-4 border-t border-black/[0.06] pt-6">
        <div className="text-[10px] uppercase tracking-[0.22em] text-brand-green/80">
          Göstəricilər
        </div>
        <PeriodIndicators changes={changes} />
      </div>
    </div>
  );
}
