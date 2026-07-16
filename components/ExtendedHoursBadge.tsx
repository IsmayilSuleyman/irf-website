import { formatAzn, formatGroupedTrim } from "@/lib/portfolio";
import { Masked } from "@/components/Masked";
import { EXTENDED_META } from "@/components/extendedHoursMeta";
import type { ExtendedPortfolio } from "@/lib/extendedPortfolio";

/**
 * "Açılışdan əvvəl: +1,03%" chip for the dashboard's market-countdown row:
 * the stock portfolio revalued at Yahoo's extended-hours prices. The pill is
 * neutral (MarketCountdown recipe); only the numbers carry the direction
 * colour. The ₼ delta respects hide-amounts mode live via <Masked> and is
 * kept out of the title attribute so the SSR HTML never leaks it. In the
 * personal view the caller passes a delta already scaled to the viewer's
 * share of the fund.
 */
const SCOPE_TOOLTIP: Record<"fund" | "personal", string> = {
  fund: "fondun ümumi dəyişimi",
  personal: "sizin payınıza düşən məbləğ",
};

export function ExtendedHoursBadge({
  data,
  scope,
}: {
  data: ExtendedPortfolio;
  scope: "fund" | "personal";
}) {
  const up = data.changePct >= 0;
  const meta = EXTENDED_META[data.mode];
  const sign = up ? "+" : "−";
  const pct = `${sign}${formatGroupedTrim(Math.abs(data.changePct) * 100, 2)}%`;
  // A delta that rounds to 0,00 ₼ (e.g. a holder with no units) is noise.
  const showDelta = Math.abs(data.deltaAzn) >= 0.005;
  const delta = `${sign}${formatAzn(Math.abs(data.deltaAzn))}`;
  const numberTone = up
    ? "text-brand-green dark:text-emerald-400"
    : "text-brand-red dark:text-red-400";

  return (
    <span
      title={`Portfel ${meta.tooltip} yenidən hesablanıb (${data.coveredCount}/${data.totalCount} mövqe)${showDelta ? ` — ${SCOPE_TOOLTIP[scope]}` : ""}`}
      className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/10 px-3 py-1.5 text-[11px] font-medium shadow-sm"
    >
      <span className={`shrink-0 ${meta.iconTint}`}>{meta.icon}</span>
      <span className="text-black/45 dark:text-white/50">{meta.label}:</span>
      <span className={`num font-semibold ${numberTone}`}>{pct}</span>
      {showDelta ? (
        <Masked mask="••••" className="text-black/45 dark:text-white/50">
          <span className={`num opacity-90 ${numberTone}`}>({delta})</span>
        </Masked>
      ) : null}
    </span>
  );
}
