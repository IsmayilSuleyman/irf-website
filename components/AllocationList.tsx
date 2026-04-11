import { formatAzn } from "@/lib/portfolio";

type Item = { name: string; valueAzn: number; percent: number };

export function AllocationList({ items }: { items: Item[] }) {
  if (!items || items.length === 0) {
    return <div className="text-white/40">Məlumat yoxdur.</div>;
  }

  const max = Math.max(...items.map((i) => i.percent), 0.0001);

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.name} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-sm text-white/80">{item.name}</span>
            <span className="num text-sm text-white/60">
              {formatAzn(item.valueAzn)}
              <span className="ml-2 text-white/40">
                {(item.percent * 100).toFixed(1)}%
              </span>
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-green to-brand-green-deep"
              style={{ width: `${(item.percent / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
