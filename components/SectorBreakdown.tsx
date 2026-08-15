import { formatAzn } from "@/lib/portfolio";
import { SectorIcon } from "@/components/SectorIcon";

type SectorRow = {
  sector: string;
  valueAzn: number;
  percent: number;
  color?: string;
};

export function SectorBreakdown({ rows }: { rows: SectorRow[] }) {
  if (!rows || rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="text-[11px] uppercase tracking-[0.16em] text-brand-green/80 sm:text-[14px] sm:tracking-[0.22em]">
        Sektor bölgüsü
      </div>
      <ul className="flex flex-col divide-y divide-[color:var(--glass-border)]">
        {rows.map((r) => (
          <li
            key={r.sector}
            className="flex items-center justify-between gap-4 py-2"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              {/* Sector glyph in a chip tinted with the sector's pie color
                  ("26" = 15% alpha) so rows still map onto the pie wedges. */}
              <span
                aria-hidden
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/5 text-black/55 dark:bg-white/10 dark:text-white/60"
                style={
                  r.color
                    ? { backgroundColor: `${r.color}26`, color: r.color }
                    : undefined
                }
              >
                <SectorIcon sector={r.sector} className="h-3.5 w-3.5" />
              </span>
              <span className="truncate text-sm text-black/85 dark:text-white/90">{r.sector}</span>
            </div>
            <div className="num shrink-0 text-sm text-black/70 dark:text-white/75">
              {formatAzn(r.valueAzn)}
              <span className="ml-2 text-black/45 dark:text-white/50">
                {(r.percent * 100).toFixed(1)}%
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
