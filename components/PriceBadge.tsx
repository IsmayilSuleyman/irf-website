import { buyPrice, sellPrice } from "@/lib/priceMath";

export function PriceBadge({ current }: { current: number }) {
  return (
    <div className="glass flex flex-col gap-2 p-6">
      <div className="text-[10px] uppercase tracking-[0.22em] text-brand-green/80">
        1 payın qiyməti
      </div>
      <div className="flex flex-col gap-1 text-sm">
        <Row label="Alış" value={buyPrice(current)} />
        <Row label="Hazırki" value={current} bold />
        <Row label="Satış" value={sellPrice(current)} />
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold = false,
}: {
  label: string;
  value: number;
  bold?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-6">
      <span className="text-black/55">{label}</span>
      <span className={`num text-black ${bold ? "font-bold" : ""}`}>
        {value.toFixed(2)} ₼
      </span>
    </div>
  );
}
