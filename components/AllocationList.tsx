import { formatAzn } from "@/lib/portfolio";

type Item = {
  name: string;
  priceUsd?: number;
  valueAzn: number;
  percent: number;
  changePct?: number | null;
  isCash?: boolean;
};

const usdFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function ChangeBadge({ pct }: { pct: number }) {
  const up = pct >= 0;
  const cls = up
    ? "bg-brand-green/15 text-brand-green"
    : "bg-brand-red/15 text-brand-red";
  const sign = up ? "+" : "";
  return (
    <span
      className={`num rounded-md px-1.5 py-0.5 text-[11px] font-medium ${cls}`}
    >
      {sign}
      {(pct * 100).toFixed(1)}%
    </span>
  );
}

export function AllocationList({ items }: { items: Item[] }) {
  if (!items || items.length === 0) {
    return <div className="text-black/40">Məlumat yoxdur.</div>;
  }

  return (
    <ul className="flex flex-col divide-y divide-[color:var(--glass-border)]">
      {items.map((item) => (
        <li
          key={item.name}
          className="flex items-center justify-between gap-4 py-3"
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm text-black/85">{item.name}</span>
            {item.priceUsd != null && !item.isCash && (
              <span className="num text-xs text-black/40">
                {usdFmt.format(item.priceUsd)}
              </span>
            )}
            {item.changePct != null && !item.isCash && (
              <ChangeBadge pct={item.changePct} />
            )}
          </div>
          <div className="num shrink-0 text-sm text-black/75">
            {formatAzn(item.valueAzn)}
            <span className="ml-2 text-black/45">
              {(item.percent * 100).toFixed(1)}%
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
