import { formatAzn } from "@/lib/portfolio";

type SectorRow = { sector: string; valueAzn: number; percent: number };

export function SectorBreakdown({ rows }: { rows: SectorRow[] }) {
  if (!rows || rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="text-[10px] uppercase tracking-[0.22em] text-brand-green/80">
        Sektor bölgüsü
      </div>
      <ul className="flex flex-col divide-y divide-[color:var(--glass-border)]">
        {rows.map((r) => (
          <li
            key={r.sector}
            className="flex items-center justify-between gap-4 py-2"
          >
            <span className="truncate text-sm text-black/85">{r.sector}</span>
            <div className="num shrink-0 text-sm text-black/75">
              {formatAzn(r.valueAzn)}
              <span className="ml-2 text-black/45">
                {(r.percent * 100).toFixed(1)}%
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
