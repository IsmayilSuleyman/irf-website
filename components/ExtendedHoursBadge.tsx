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
// Each window keeps its own icon tint regardless of the chip's green/red
// direction tone: amber sunrise (pre), purple sunset (post), blue moon
// (overnight) — İsmayıl's visual language for the three windows.
const LABELS: Record<
  ExtendedPortfolio["mode"],
  { chip: string; tooltip: string; iconTint: string; icon: React.ReactNode }
> = {
  pre: {
    chip: "Açılışdan əvvəl",
    tooltip: "açılışdan əvvəlki (pre-market) qiymətlərlə",
    iconTint: "text-amber-500 dark:text-amber-400",
    icon: (
      // Sunrise: sun climbing over the horizon.
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 10V3" />
        <path d="m8 7 4-4 4 4" />
        <path d="M4.93 12.93l1.41 1.41" />
        <path d="M2 18h2" />
        <path d="M20 18h2" />
        <path d="m19.07 12.93-1.41 1.41" />
        <path d="M16 18a4 4 0 0 0-8 0" />
        <path d="M22 22H2" />
      </svg>
    ),
  },
  post: {
    chip: "Bağlanışdan sonra",
    tooltip: "bağlanışdan sonrakı (after-market) qiymətlərlə",
    iconTint: "text-purple-500 dark:text-purple-400",
    icon: (
      // Sunset: sun sinking toward the horizon.
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 3v7" />
        <path d="m8 6 4 4 4-4" />
        <path d="M4.93 12.93l1.41 1.41" />
        <path d="M2 18h2" />
        <path d="M20 18h2" />
        <path d="m19.07 12.93-1.41 1.41" />
        <path d="M16 18a4 4 0 0 0-8 0" />
        <path d="M22 22H2" />
      </svg>
    ),
  },
  // The gap between after-market close and pre-market open (nights and
  // weekends): the badge carries the last after-market close move.
  overnight: {
    chip: "Gecə",
    tooltip: "son bağlanışdan sonrakı (after-market) qiymətlərlə",
    iconTint: "text-blue-500 dark:text-blue-400",
    icon: (
      // Crescent moon.
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79" />
      </svg>
    ),
  },
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
  // The pill stays neutral (same recipe as the MarketCountdown chip); only
  // the numbers carry the direction colour, like every other figure on the
  // dashboard.
  const numberTone = up
    ? "text-brand-green dark:text-emerald-400"
    : "text-brand-red dark:text-red-400";

  return (
    <span
      title={`Portfel ${label.tooltip} yenidən hesablanıb (${data.coveredCount}/${data.totalCount} mövqe)${showDelta ? ` — ${SCOPE_TOOLTIP[scope]}` : ""}`}
      className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/10 px-3 py-1.5 text-[11px] font-medium shadow-sm"
    >
      <span className={`shrink-0 ${label.iconTint}`}>{label.icon}</span>
      <span className="text-black/45 dark:text-white/50">{label.chip}:</span>
      <span className={`num font-semibold ${numberTone}`}>{pct}</span>
      {showDelta ? (
        <Masked mask="••••" className="text-black/45 dark:text-white/50">
          <span className={`num opacity-90 ${numberTone}`}>({delta})</span>
        </Masked>
      ) : null}
    </span>
  );
}
