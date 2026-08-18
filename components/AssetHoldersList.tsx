import { formatAzn, formatPct } from "@/lib/portfolio";
import { toTitleCaseAz } from "@/lib/user";
import { Masked } from "@/components/Masked";
import type { AssetHolderSummary } from "@/lib/personalAssets";

/**
 * Whole-fund view: everyone holding personal ETF assets (SPY / IBIT / GLDM /
 * SIVR) and their books' live value — deliberately separate from Pay
 * sahibləri, because these sit outside the fund. The money itself rests at
 * İsmayılBank as a non-interest, untouchable reserve; the footnote says so.
 */
export function AssetHoldersList({
  holders,
}: {
  holders: AssetHolderSummary[];
}) {
  const rows = holders.filter((h) => h.valueAzn > 0);
  if (rows.length === 0) return null;
  const total = rows.reduce((s, h) => s + h.valueAzn, 0);

  return (
    <div className="glass flex flex-col gap-2.5 p-4">
      <div className="text-[11px] uppercase tracking-[0.16em] text-brand-green/80 sm:text-[14px] sm:tracking-[0.22em]">
        Digər Aktivlər Sahibləri
      </div>
      <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-1 text-[13px]">
        {rows.map((h, i) => (
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
              <span className="num w-12 text-right text-[10px] text-black/45 dark:text-white/50">
                <Masked mask="••">
                  {formatPct(total > 0 ? h.valueAzn / total : 0)}
                </Masked>
              </span>
            </span>
          </div>
        ))}
      </div>
      <p className="text-[10px] leading-relaxed text-black/45 dark:text-white/50">
        İsmayılBank tərəfindən təqdim olunur — vəsait bankda faizsiz,
        toxunulmaz ehtiyat kimi ayrıca saxlanılır.
      </p>
    </div>
  );
}
