import {
  evaluateCashRule,
  type PolicyReport,
} from "@/lib/investmentPolicy";
import {
  isExtremeFear,
  type FearGreed,
  type MarketSignals,
} from "@/lib/marketSignals";
import { formatGrouped } from "@/lib/portfolio";

// "Bazar siqnalları" slide for the Fond Portfeli pie-slot carousel: the CNN
// Fear and Greed reading and the S&P 500's distance from its all-time high —
// the two inputs of the investment policy's dip-buying trigger (§4). Shares
// the carousel's h-72 footprint so flipping never shifts the layout.

function zoneAz(fg: FearGreed): { label: string; pill: string } {
  const neutral = "bg-black/5 text-black/55 dark:bg-white/10 dark:text-white/60";
  const r = fg.rating.toLowerCase();
  const byScore = (lo: number, hi: number) => fg.score >= lo && fg.score <= hi;
  if (r.includes("extreme fear") || (!r && byScore(0, 25)))
    return {
      label: "İfrat qorxu",
      pill: "bg-brand-green/15 text-brand-green dark:text-emerald-400",
    };
  if (r.includes("extreme greed") || (!r && byScore(76, 100)))
    return {
      label: "İfrat hərislik",
      pill: "bg-brand-red/15 text-brand-red dark:text-red-400",
    };
  if (r.includes("fear") || (!r && byScore(26, 45)))
    return { label: "Qorxu", pill: neutral };
  if (r.includes("greed") || (!r && byScore(56, 75)))
    return {
      label: "Hərislik",
      pill: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    };
  return { label: "Neytral", pill: neutral };
}

export function MarketSignalsPanel({
  report,
  signals,
}: {
  report: PolicyReport;
  signals: MarketSignals;
}) {
  const fg = signals.fearGreed;
  const sp = signals.sp500;
  const cashRule = evaluateCashRule(report, {
    extremeFear: isExtremeFear(fg),
    drawdown: sp?.drawdown ?? null,
  });
  const zone = fg ? zoneAz(fg) : null;

  return (
    <div className="flex h-72 w-full flex-col items-center justify-center gap-5 px-8">
      <span className="text-[10px] uppercase tracking-[0.22em] text-black/45 dark:text-white/50">
        Bazar siqnalları
      </span>
      <div className="flex w-full max-w-[16rem] flex-col gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-black/55 dark:text-white/60">
            CNN Fear and Greed indeksi
          </span>
          {fg && zone ? (
            <div className="flex items-baseline gap-2.5">
              <span className="num text-3xl font-semibold text-black dark:text-white/90">
                {fg.score}
              </span>
              <span
                className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${zone.pill}`}
              >
                {zone.label}
              </span>
            </div>
          ) : (
            <span className="text-sm text-black/45 dark:text-white/50">
              əlçatan deyil
            </span>
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-black/55 dark:text-white/60">
            S&amp;P 500 tarixi zirvədən
          </span>
          {sp ? (
            <div className="flex items-baseline gap-2.5">
              <span
                className={`num text-3xl font-semibold ${
                  sp.drawdown <= -0.15
                    ? "text-brand-green dark:text-emerald-400"
                    : "text-black dark:text-white/90"
                }`}
              >
                {sp.drawdown >= 0
                  ? "0.0%"
                  : `−${(-sp.drawdown * 100).toFixed(1)}%`}
              </span>
              <span className="num text-[11px] text-black/45 dark:text-white/50">
                {formatGrouped(sp.price, 0)} / zirvə{" "}
                {formatGrouped(sp.allTimeHigh, 0)}
              </span>
            </div>
          ) : (
            <span className="text-sm text-black/45 dark:text-white/50">
              əlçatan deyil
            </span>
          )}
        </div>
      </div>
      <span
        className={`max-w-[16rem] text-center text-[10px] leading-relaxed ${
          cashRule.state === "deploy"
            ? "font-medium text-brand-green dark:text-emerald-400"
            : "text-black/40 dark:text-white/45"
        }`}
      >
        {cashRule.state === "deploy"
          ? "Dib-alış triggeri aktivdir — hər ay nağdın 1/3-i Geniş bazar ETF-inə."
          : cashRule.state === "unknown"
            ? "Siqnallar hazırda əlçatan deyil — trigger qiymətləndirilməyib."
            : "Dib-alış triggeri deaktivdir — İfrat qorxu yoxdur, S&P zirvədən −15%-ə çatmayıb."}
      </span>
    </div>
  );
}
