import { formatAzn, formatPct } from "@/lib/portfolio";
import { toTitleCaseAz } from "@/lib/user";
import { Masked } from "@/components/Masked";

type Shareholder = { name: string; valueAzn: number; percent: number };

/**
 * Whole-fund view only: every shareholder and how much of the Fund they own in
 * AZN (largest first), with their share of the Fund as a muted suffix.
 * Amounts respect hide-amounts mode (they are positions, someone's).
 */
export function ShareholdersList({ holders }: { holders: Shareholder[] }) {
  const sorted = [...holders]
    .filter((h) => h.valueAzn > 0)
    .sort((a, b) => b.valueAzn - a.valueAzn);

  return (
    <div className="glass flex flex-col gap-3 p-6">
      <div className="text-[10px] uppercase tracking-[0.22em] text-brand-green/80">
        Pay sahibləri
      </div>
      {sorted.length === 0 ? (
        <div className="text-sm text-black/45 dark:text-white/50">Sahib yoxdur.</div>
      ) : (
        <div className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1 text-sm">
          {sorted.map((h, i) => (
            <div
              key={`${h.name}-${i}`}
              className="flex items-baseline justify-between gap-3"
            >
              <span className="min-w-0 truncate text-black/70 dark:text-white/75">
                {toTitleCaseAz(h.name)}
              </span>
              <span className="flex shrink-0 items-baseline gap-2">
                <span className="num font-medium text-black dark:text-white/90">
                  <Masked>{formatAzn(h.valueAzn)}</Masked>
                </span>
                <span className="num w-14 text-right text-[11px] text-black/45 dark:text-white/50">
                  <Masked mask="••">{formatPct(h.percent)}</Masked>
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
