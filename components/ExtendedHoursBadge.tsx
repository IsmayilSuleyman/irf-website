import { formatAzn, formatGroupedTrim } from "@/lib/portfolio";
import { Masked } from "@/components/Masked";
import type { ExtendedPortfolio } from "@/lib/extendedPortfolio";

/**
 * "Pre-market: +1,03%" chip for the dashboard's market-countdown row: the
 * whole stock portfolio revalued at Yahoo's extended-hours prices. The
 * percentage is public market-wide info and stays visible; the AZN delta
 * respects hide-amounts mode live via <Masked> (and is kept out of the
 * title attribute so the SSR HTML never leaks it).
 */
export function ExtendedHoursBadge({ data }: { data: ExtendedPortfolio }) {
  const up = data.changePct >= 0;
  const label = data.mode === "pre" ? "Pre-market" : "After-market";
  const sign = up ? "+" : "−";
  const pct = `${sign}${formatGroupedTrim(Math.abs(data.changePct) * 100, 2)}%`;
  const delta = `${sign}${formatAzn(Math.abs(data.deltaAzn))}`;
  const tone = up
    ? "border-brand-green/30 bg-brand-green/5 text-brand-green dark:text-emerald-400"
    : "border-brand-red/30 bg-brand-red/5 text-brand-red dark:text-red-400";

  return (
    <span
      title={`Portfel ${label.toLocaleLowerCase("az-AZ")} qiymətləri ilə yenidən hesablanıb (${data.coveredCount}/${data.totalCount} mövqe)`}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium shadow-sm ${tone}`}
    >
      <span>{label}:</span>
      <span className="num font-semibold">{pct}</span>
      <Masked mask="••••" className="opacity-75">
        <span className="num opacity-75">({delta})</span>
      </Masked>
    </span>
  );
}
