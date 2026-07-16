import { formatAzn, formatGroupedTrim } from "@/lib/portfolio";
import { Masked } from "@/components/Masked";
import type { ExtendedPortfolio } from "@/lib/extendedPortfolio";

/**
 * "Açılışdan əvvəl: +1,03%" chip for the dashboard's market-countdown row:
 * the stock portfolio revalued at Yahoo's extended-hours prices. The
 * percentage is market-wide info and stays visible; the ₼ delta respects
 * hide-amounts mode live via <Masked> (and is kept out of the title
 * attribute so the SSR HTML never leaks it). In the personal view the
 * caller passes a delta already scaled to the viewer's share of the fund.
 */
const LABELS: Record<ExtendedPortfolio["mode"], { chip: string; tooltip: string }> = {
  pre: { chip: "Açılışdan əvvəl", tooltip: "açılışdan əvvəlki (pre-market) qiymətlərlə" },
  post: { chip: "Bağlanışdan sonra", tooltip: "bağlanışdan sonrakı (after-market) qiymətlərlə" },
  // The gap between after-market close and pre-market open (nights and
  // weekends): the badge carries the last after-market close move.
  overnight: { chip: "Gecə", tooltip: "son bağlanışdan sonrakı (after-market) qiymətlərlə" },
};

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
  const label = LABELS[data.mode];
  const sign = up ? "+" : "−";
  const pct = `${sign}${formatGroupedTrim(Math.abs(data.changePct) * 100, 2)}%`;
  // A delta that rounds to 0,00 ₼ (e.g. a holder with no units) is noise.
  const showDelta = Math.abs(data.deltaAzn) >= 0.005;
  const delta = `${sign}${formatAzn(Math.abs(data.deltaAzn))}`;
  const tone = up
    ? "border-brand-green/30 bg-brand-green/5 text-brand-green dark:text-emerald-400"
    : "border-brand-red/30 bg-brand-red/5 text-brand-red dark:text-red-400";

  return (
    <span
      title={`Portfel ${label.tooltip} yenidən hesablanıb (${data.coveredCount}/${data.totalCount} mövqe)${showDelta ? ` — ${SCOPE_TOOLTIP[scope]}` : ""}`}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium shadow-sm ${tone}`}
    >
      <span>{label.chip}:</span>
      <span className="num font-semibold">{pct}</span>
      {showDelta ? (
        <Masked mask="••••" className="opacity-75">
          <span className="num opacity-75">({delta})</span>
        </Masked>
      ) : null}
    </span>
  );
}
