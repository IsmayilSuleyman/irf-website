"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CLOSE_CALL_GAP,
  DEFAULT_WEIGHTS,
  healthLabel,
  portfolioAlpha13w,
  scoreUniverse,
  type MomentumItem,
  type MomentumWeights,
  type ScoredItem,
} from "@/lib/momentum";
import { sectorColor } from "@/lib/sectorColors";
import { SectorIcon } from "@/components/SectorIcon";
import {
  FACTORS,
  fmtPct,
  MomentumFactorTable,
  scoreTone,
} from "@/components/MomentumFactorTable";

// Momentum leaderboard for the dashboard: compact rows (rank, sector glyph,
// ticker, factor-rank summary, score bar) that expand into the full factor
// table on tap. Weights are adjustable client-side — scores, ranks, health
// and close calls all recompute live.

const TONE_PILL: Record<"red" | "amber" | "green", string> = {
  green: "bg-brand-green/15 text-brand-green dark:text-emerald-400",
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  red: "bg-brand-red/15 text-brand-red dark:text-red-400",
};

function SummaryLine({ row }: { row: ScoredItem }) {
  const parts = FACTORS.map((f) => {
    const rank = row.ranks[f.key];
    return `${f.short} ${rank != null ? `#${rank}` : "—"}`;
  });
  return (
    <span className="num truncate text-[10px] text-black/45 dark:text-white/50">
      {parts.join(" · ")}
      {" · 200GO "}
      {row.above200 == null ? "—" : row.above200 ? "✓" : "✗"}
    </span>
  );
}

function WeightsPanel({
  weights,
  onChange,
}: {
  weights: MomentumWeights;
  onChange: (w: MomentumWeights) => void;
}) {
  const entries: { label: string; key: keyof MomentumWeights }[] = [
    ...FACTORS.map((f) => ({ label: f.short, key: f.weightKey })),
    { label: "200GO", key: "wTrend" as const },
  ];
  const total = entries.reduce((s, e) => s + Math.max(0, weights[e.key]), 0);
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-black/10 p-3 dark:border-white/15">
      {entries.map((e) => (
        <label key={e.key} className="flex items-center gap-3 text-[11px]">
          <span className="w-12 shrink-0 font-medium text-black/60 dark:text-white/65">
            {e.label}
          </span>
          <input
            type="range"
            min={0}
            max={50}
            step={5}
            value={weights[e.key]}
            onChange={(ev) =>
              onChange({ ...weights, [e.key]: Number(ev.target.value) })
            }
            className="h-1 flex-1"
            style={{ accentColor: "#16a34a" }}
          />
          <span className="num w-10 shrink-0 text-right text-black/55 dark:text-white/60">
            {total > 0
              ? `${Math.round((Math.max(0, weights[e.key]) / total) * 100)}%`
              : "—"}
          </span>
        </label>
      ))}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-black/40 dark:text-white/45">
          Çəkilər cəmə görə normallaşdırılır.
        </span>
        <button
          type="button"
          onClick={() => onChange(DEFAULT_WEIGHTS)}
          className="rounded-full border border-black/10 px-2.5 py-1 text-[10px] font-medium text-black/55 transition hover:text-black/80 dark:border-white/15 dark:text-white/60 dark:hover:text-white/85"
        >
          Standart (30/25/20/15/10)
        </button>
      </div>
    </div>
  );
}

export function MomentumBoard({
  items,
  spyRet13w,
}: {
  items: MomentumItem[];
  spyRet13w: number | null;
}) {
  const [weights, setWeights] = useState<MomentumWeights>(DEFAULT_WEIGHTS);
  const [showWeights, setShowWeights] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const board = useMemo(() => scoreUniverse(items, weights), [items, weights]);
  const alpha = useMemo(
    () => portfolioAlpha13w(items, spyRet13w),
    [items, spyRet13w],
  );

  if (board.rows.length === 0) return null;

  const health = board.health;
  const closeCallPairs = board.rows.filter((r) => r.closeCall).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[10px] uppercase tracking-[0.22em] text-brand-green/80">
          Momentum Reytinqi
        </div>
        <button
          type="button"
          onClick={() => setShowWeights((v) => !v)}
          aria-expanded={showWeights}
          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
            showWeights
              ? "border-transparent bg-brand-green/15 text-brand-green dark:text-emerald-400"
              : "border-black/10 text-black/45 hover:text-black/70 dark:border-white/15 dark:text-white/50 dark:hover:text-white/75"
          }`}
        >
          Çəkilər
        </button>
      </div>

      {/* Status pills: portfolio health, alpha vs SPY, close-call alert. */}
      <div className="flex flex-wrap items-center gap-1.5">
        {health != null && (
          <span
            className={`num rounded-md px-2 py-0.5 text-[11px] font-medium ${TONE_PILL[healthLabel(health).tone]}`}
          >
            Sağlamlıq: {health.toFixed(1)} · {healthLabel(health).label}
          </span>
        )}
        {alpha != null && (
          <span
            className={`num rounded-md px-2 py-0.5 text-[11px] font-medium ${
              alpha >= 0 ? TONE_PILL.green : TONE_PILL.red
            }`}
          >
            SPY-a qarşı (13H): {fmtPct(alpha)}
          </span>
        )}
        {closeCallPairs > 0 && (
          <span
            className={`num rounded-md px-2 py-0.5 text-[11px] font-medium ${TONE_PILL.amber}`}
          >
            Yaxın nəticə: {closeCallPairs} sətir (±{CLOSE_CALL_GAP.toFixed(1)})
          </span>
        )}
      </div>

      <AnimatePresence initial={false}>
        {showWeights && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <WeightsPanel weights={weights} onChange={setWeights} />
          </motion.div>
        )}
      </AnimatePresence>

      <ul className="flex flex-col divide-y divide-[color:var(--glass-border)]">
        {board.rows.map((row, i) => {
          const tone = scoreTone(row.score);
          const open = !!expanded[row.symbol];
          const color = sectorColor(row.sector);
          return (
            <li key={row.symbol}>
              <button
                type="button"
                onClick={() =>
                  setExpanded((e) => ({ ...e, [row.symbol]: !e[row.symbol] }))
                }
                aria-expanded={open}
                className="flex w-full items-center gap-2.5 py-2.5 text-left"
              >
                <span className="num w-4 shrink-0 text-right text-xs text-black/45 dark:text-white/55">
                  {i + 1}
                </span>
                <span
                  aria-hidden
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${color}26`, color }}
                >
                  <SectorIcon sector={row.sector ?? ""} className="h-3.5 w-3.5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-1.5">
                    <span className="num text-sm font-semibold tracking-wide text-black/85 dark:text-white/90">
                      {row.symbol}
                    </span>
                    {row.closeCall && (
                      <span
                        title="Yaxın nəticə — sıralama bu həftə kövrəkdir"
                        className={`rounded px-1 text-[9px] font-semibold ${TONE_PILL.amber}`}
                      >
                        ±
                      </span>
                    )}
                  </span>
                  <SummaryLine row={row} />
                </span>
                <span className="flex w-24 shrink-0 flex-col items-end gap-1">
                  <span className={`num text-sm font-semibold ${tone.text}`}>
                    {row.score.toFixed(1)}
                  </span>
                  <span className="h-1 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                    <span
                      className={`block h-full rounded-full ${tone.bar}`}
                      style={{ width: `${Math.max(2, Math.min(100, row.score))}%` }}
                    />
                  </span>
                </span>
              </button>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    <MomentumFactorTable
                      row={row}
                      weights={weights}
                      className="pb-2 pl-14 pr-1 pt-1"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>

      <div className="text-[10px] leading-relaxed text-black/40 dark:text-white/45">
        4H = 4 həftəlik gəlir · 13H = 13 həftəlik gəlir · YTD = ilin
        əvvəlindən · RS = SPY-a nisbi güc (13H) · 200GO = 200 günlük ortalama.
        Bal: hər amil üzrə sıra (N−yer)/(N−1) ilə 0–100 normallaşır, çəkili
        orta yekun baldır. Məlumatı çatışmayan amillər çəkidən çıxarılır.
      </div>
    </div>
  );
}
