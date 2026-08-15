import type { ReactNode } from "react";
import { Masked } from "@/components/Masked";
import {
  formatAzn,
  formatGrouped,
  formatGroupedTrim,
  formatUnits,
} from "@/lib/portfolio";
import { ASSET_ICONS } from "@/components/assetIcons";
import type { AssetPosition } from "@/lib/personalAssets";

// "Aktivlərim" — the holder's whole personal book: the İRF pay position
// first (AZN-denominated, day change from the unit price), then the ETF
// positions from the Aktivlər ledger valued live. Renders nothing when the
// viewer holds neither.

const pct = (n: number) =>
  `${n >= 0 ? "+" : "−"}${formatGroupedTrim(Math.abs(n) * 100, 2)}%`;

const toneOf = (n: number | null) =>
  n == null
    ? "text-black/45 dark:text-white/50"
    : n >= 0
      ? "text-brand-green dark:text-emerald-400"
      : "text-brand-red dark:text-red-400";

export type IrfHoldingSummary = {
  units: number;
  avgBuyAzn: number | null;
  valueAzn: number;
  dayChangePct: number | null;
  totalPnlAzn: number | null;
};

type DisplayRow = {
  key: string;
  icon: ReactNode;
  label: string;
  symbol: string;
  units: number;
  avgText: string | null;
  valueAzn: number | null;
  dayChangePct: number | null;
  totalPnlAzn: number | null;
};

export function AssetHoldingsCard({
  positions,
  irf,
  showBuyHint = true,
}: {
  positions: AssetPosition[];
  /** The viewer's İRF pay position, rendered as the first row. */
  irf?: IrfHoldingSummary | null;
  /** false for İsmayıl — the how-to-order note is not for the counterparty. */
  showBuyHint?: boolean;
}) {
  const rows: DisplayRow[] = [
    ...(irf
      ? [
          {
            key: "irf",
            icon: ASSET_ICONS.irf,
            label: "İRF Payı",
            symbol: "İRF",
            units: irf.units,
            avgText:
              irf.avgBuyAzn != null
                ? `ort. ${formatGrouped(irf.avgBuyAzn, 2)}₼`
                : null,
            valueAzn: irf.valueAzn,
            dayChangePct: irf.dayChangePct,
            totalPnlAzn: irf.totalPnlAzn,
          },
        ]
      : []),
    ...positions.map((p) => ({
      key: p.symbol,
      icon: p.iconKey ? ASSET_ICONS[p.iconKey] : null,
      label: p.label,
      symbol: p.symbol,
      units: p.units,
      avgText:
        p.avgBuyUsd != null ? `ort. ${formatGrouped(p.avgBuyUsd, 2)}$` : null,
      valueAzn: p.valueAzn,
      dayChangePct: p.dayChangePct,
      totalPnlAzn: p.totalPnlAzn,
    })),
  ];
  if (rows.length === 0) return null;

  const totalValue = rows.reduce((s, r) => s + (r.valueAzn ?? 0), 0);
  const hasPnl = rows.some((r) => r.totalPnlAzn != null);
  const totalPnl = hasPnl
    ? rows.reduce((s, r) => s + (r.totalPnlAzn ?? 0), 0)
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
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              {r.icon}
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold text-black/85 dark:text-white/90">
                  {r.label}{" "}
                  <span className="num text-[11px] font-medium text-black/45 dark:text-white/50">
                    {r.symbol}
                  </span>
                </span>
                <span className="num text-[11px] text-black/45 dark:text-white/50">
                  <Masked mask="••">{formatUnits(r.units)}</Masked> ədəd
                  {r.avgText ? ` · ${r.avgText}` : ""}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end">
              <span className="num text-sm font-semibold text-black/85 dark:text-white/90">
                {r.valueAzn != null ? (
                  <Masked mask="••••">{formatAzn(r.valueAzn)}</Masked>
                ) : (
                  "—"
                )}
              </span>
              <span className="num text-[11px]">
                {r.dayChangePct != null ? (
                  <span className={toneOf(r.dayChangePct)}>
                    {pct(r.dayChangePct)}
                  </span>
                ) : null}
                {r.totalPnlAzn != null ? (
                  <span className={`ml-2 ${toneOf(r.totalPnlAzn)}`}>
                    <Masked mask="••••">
                      {`${r.totalPnlAzn >= 0 ? "+" : ""}${formatAzn(r.totalPnlAzn)}`}
                    </Masked>
                  </span>
                ) : null}
              </span>
            </div>
          </div>
        ))}
      </div>

      {showBuyHint && (
        <p className="text-[11px] leading-relaxed text-black/45 dark:text-white/50">
          SPY, IBIT, GLDM və SIVR — İRF paylarından ayrı saxlanılan şəxsi ETF
          aktivləri. Almaq və ya satmaq üçün İsmayıl ilə əlaqə saxlayın —
          sifarişlər şifahi qəbul olunur.
        </p>
      )}
    </div>
  );
}
