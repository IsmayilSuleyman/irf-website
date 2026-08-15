import { Masked } from "@/components/Masked";
import {
  formatAzn,
  formatGrouped,
  formatGroupedTrim,
  formatUnits,
} from "@/lib/portfolio";
import { ASSET_ICONS } from "@/components/assetIcons";
import type { AssetPosition } from "@/lib/personalAssets";

// "Aktivlərim" — the holder's personal ETF positions from the Aktivlər
// ledger, valued live. Renders nothing when the viewer holds nothing (which
// also self-hides it for İsmayıl — he is the counterparty, never a buyer).

const pct = (n: number) =>
  `${n >= 0 ? "+" : "−"}${formatGroupedTrim(Math.abs(n) * 100, 2)}%`;

const toneOf = (n: number | null) =>
  n == null
    ? "text-black/45 dark:text-white/50"
    : n >= 0
      ? "text-brand-green dark:text-emerald-400"
      : "text-brand-red dark:text-red-400";

export function AssetHoldingsCard({
  positions,
}: {
  positions: AssetPosition[];
}) {
  if (positions.length === 0) return null;

  const totalValue = positions.reduce((s, p) => s + (p.valueAzn ?? 0), 0);
  const hasPnl = positions.some((p) => p.totalPnlAzn != null);
  const totalPnl = hasPnl
    ? positions.reduce((s, p) => s + (p.totalPnlAzn ?? 0), 0)
    : null;

  return (
    <div className="glass flex flex-col gap-5 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[14px] uppercase tracking-[0.22em] text-brand-green/80">
          Aktivlərim
        </span>
        <span className="num text-sm font-semibold text-black/85 dark:text-white/90">
          <Masked mask="••••">{formatAzn(totalValue)}</Masked>
          {totalPnl != null ? (
            <span className={`ml-2 text-[11px] font-medium ${toneOf(totalPnl)}`}>
              <Masked mask="••••">
                {`${totalPnl >= 0 ? "+" : ""}${formatAzn(totalPnl)}`}
              </Masked>
            </span>
          ) : null}
        </span>
      </div>

      <div className="flex flex-col gap-3.5">
        {positions.map((p) => (
          <div
            key={p.symbol}
            className="flex items-center justify-between gap-3"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              {p.iconKey ? ASSET_ICONS[p.iconKey] : null}
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold text-black/85 dark:text-white/90">
                  {p.label}{" "}
                  <span className="num text-[11px] font-medium text-black/45 dark:text-white/50">
                    {p.symbol}
                  </span>
                </span>
                <span className="num text-[11px] text-black/45 dark:text-white/50">
                  <Masked mask="••">{formatUnits(p.units)}</Masked> ədəd
                  {p.avgBuyUsd != null
                    ? ` · ort. ${formatGrouped(p.avgBuyUsd, 2)}$`
                    : ""}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end">
              <span className="num text-sm font-semibold text-black/85 dark:text-white/90">
                {p.valueAzn != null ? (
                  <Masked mask="••••">{formatAzn(p.valueAzn)}</Masked>
                ) : (
                  "—"
                )}
              </span>
              <span className="num text-[11px]">
                {p.dayChangePct != null ? (
                  <span className={toneOf(p.dayChangePct)}>
                    {pct(p.dayChangePct)}
                  </span>
                ) : null}
                {p.totalPnlAzn != null ? (
                  <span className={`ml-2 ${toneOf(p.totalPnlAzn)}`}>
                    <Masked mask="••••">
                      {`${p.totalPnlAzn >= 0 ? "+" : ""}${formatAzn(p.totalPnlAzn)}`}
                    </Masked>
                  </span>
                ) : null}
              </span>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px] leading-relaxed text-black/45 dark:text-white/50">
        İRF paylarından ayrı saxlanılan şəxsi aktivlər. Almaq və ya satmaq
        üçün İsmayıl ilə əlaqə saxlayın — sifarişlər şifahi qəbul olunur.
      </p>
    </div>
  );
}
