import { formatAzn, formatUnits } from "@/lib/portfolio";

export function HeroPrice({
  holderName,
  holdingValue,
  holdingPnl,
  units,
  avgBuyPrice,
}: {
  holderName: string;
  holdingValue: number;
  holdingPnl: number | null;
  units: number;
  avgBuyPrice: number | null;
}) {
  const tone =
    holdingPnl == null
      ? "text-black/35"
      : holdingPnl >= 0
        ? "text-brand-green"
        : "text-brand-red";

  const pnlText =
    holdingPnl == null
      ? "—"
      : `${holdingPnl >= 0 ? "+" : ""}${holdingPnl.toFixed(2)}₼`;

  return (
    <div className="flex flex-col gap-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-green">
        Xoş gəldin, {holderName}
      </div>
      <div className="flex items-end gap-4">
        <div
          className="num font-black leading-none tracking-tight"
          style={{ fontSize: "clamp(3rem, 9vw, 6.5rem)" }}
        >
          {holdingValue.toFixed(2)}₼
        </div>
        <div className={`num text-xl md:text-2xl font-semibold pb-2 ${tone}`}>
          {pnlText}
        </div>
      </div>
      <div className="text-sm text-black/50">
        {formatUnits(units)} pay · ortalama alış{" "}
        <span className="text-black/75">
          {avgBuyPrice != null ? formatAzn(avgBuyPrice) : "N/A"}
        </span>
      </div>
    </div>
  );
}
