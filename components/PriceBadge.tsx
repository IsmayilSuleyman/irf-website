import { Odometer } from "@/components/Odometer";

export function PriceBadge({
  current,
  ask,
  bid,
}: {
  current: number;
  ask: number | null;
  bid: number;
}) {
  return (
    <div className="glass flex flex-col gap-2 p-6">
      <div className="text-[10px] uppercase tracking-[0.22em] text-brand-green/80">
        1 payın qiyməti
      </div>
      <div className="flex flex-col gap-1 text-sm">
        <Row label="Alış" value={ask} />
        <Row label="Hazırki" value={current} bold />
        <Row label="Satış" value={bid} />
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
  value: number | null;
  bold?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-6">
      <span className="text-black/55">{label}</span>
      <span className={`num text-black ${bold ? "font-bold" : ""}`}>
        {value != null ? (
          <Odometer value={value} fractionDigits={2} suffix=" ₼" />
        ) : (
          "—"
        )}
      </span>
    </div>
  );
}
