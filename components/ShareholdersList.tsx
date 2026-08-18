import { formatAzn, formatPct } from "@/lib/portfolio";
import { toTitleCaseAz } from "@/lib/user";
import { Masked } from "@/components/Masked";
import { IsmayilBankLogo } from "@/components/IsmayilBankLogo";
import type { AssetHolderSummary } from "@/lib/personalAssets";

type Shareholder = { name: string; valueAzn: number; percent: number };

function HolderRow({
  name,
  valueAzn,
  pct,
}: {
  name: string;
  valueAzn: number;
  pct: number;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="min-w-0 truncate text-black/70 dark:text-white/75">
        {toTitleCaseAz(name)}
      </span>
      <span className="flex shrink-0 items-baseline gap-2">
        <span className="num font-medium text-black dark:text-white/90">
          <Masked>{formatAzn(valueAzn)}</Masked>
        </span>
        <span className="num w-12 text-right text-[10px] text-black/45 dark:text-white/50">
          <Masked mask="••">{formatPct(pct)}</Masked>
        </span>
      </span>
    </div>
  );
}

/**
 * Whole-fund view, one card: every shareholder's slice of the Fund, then —
 * when the Aktivlər ledger has rows — the personal-ETF holders beneath it
 * (their books live outside the fund, at İsmayılBank as a non-interest,
 * untouchable reserve; the logo line says who provides it). Amounts respect
 * hide-amounts mode.
 */
export function ShareholdersList({
  holders,
  assetHolders = [],
}: {
  holders: Shareholder[];
  assetHolders?: AssetHolderSummary[];
}) {
  const sorted = [...holders]
    .filter((h) => h.valueAzn > 0)
    .sort((a, b) => b.valueAzn - a.valueAzn);
  const assetRows = assetHolders.filter((h) => h.valueAzn > 0);
  const assetTotal = assetRows.reduce((s, h) => s + h.valueAzn, 0);

  return (
    <div className="glass flex flex-col gap-2.5 p-4">
      <div className="text-[11px] uppercase tracking-[0.16em] text-brand-green/80 sm:text-[14px] sm:tracking-[0.22em]">
        Pay sahibləri
      </div>
      {sorted.length === 0 ? (
        <div className="text-[13px] text-black/45 dark:text-white/50">
          Sahib yoxdur.
        </div>
      ) : (
        <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-1 text-[13px]">
          {sorted.map((h, i) => (
            <HolderRow
              key={`${h.name}-${i}`}
              name={h.name}
              valueAzn={h.valueAzn}
              pct={h.percent}
            />
          ))}
        </div>
      )}

      {assetRows.length > 0 && (
        <>
          <div className="mt-2.5 text-[11px] uppercase tracking-[0.16em] text-brand-green/80 sm:text-[14px] sm:tracking-[0.22em]">
            Digər Aktivlər Sahibləri
          </div>
          <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-1 text-[13px]">
            {assetRows.map((h, i) => (
              <HolderRow
                key={`${h.name}-${i}`}
                name={h.name}
                valueAzn={h.valueAzn}
                pct={assetTotal > 0 ? h.valueAzn / assetTotal : 0}
              />
            ))}
          </div>
          {/* The logo wordmark already says İsmayılBank — the text only
              carries the rest of the sentence. */}
          <p className="mt-1 flex items-center gap-1.5 text-[10px] leading-relaxed text-black/45 dark:text-white/50">
            <IsmayilBankLogo size={15} />
            tərəfindən təqdim olunur
          </p>
        </>
      )}
    </div>
  );
}
