"use client";

import { useEffect, useState } from "react";
import { nextUsMarketTransition } from "@/lib/marketHours";
import { RefreshTimer } from "@/components/RefreshTimer";
import { SessionHistoryChart } from "@/components/SessionHistoryChart";
import { latestSessionTail, type SessionHistoryPoint } from "@/lib/sessionHistory";

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const clock = `${pad(h)}:${pad(m)}:${pad(s)}`;
  return days > 0 ? `${days} gün ${clock}` : clock;
}

const REGULAR_GREEN = "#16a34a";

export function MarketCountdown({
  history,
}: {
  /**
   * Regular-session (intraday day-change) snapshots for the hover chart;
   * omitted on pages that don't fetch it (e.g. /market) — the chip then
   * renders exactly as before, without a popover.
   */
  history?: SessionHistoryPoint[];
}) {
  const [now, setNow] = useState<Date | null>(null);
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<"daily" | "weekly">("daily");

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Render nothing until computed on the client (avoids a hydration mismatch).
  if (!now) return null;

  const { open: marketOpen, at } = nextUsMarketTransition(now);
  const remaining = at.getTime() - now.getTime();
  const hasHistory = history != null;
  // Daily = the newest contiguous session (8h window fits the 6.5h regular
  // session); weekly = every recorded intraday point of the last 7 days,
  // each day's curve starting from its own open.
  const points =
    history == null
      ? []
      : range === "daily"
        ? latestSessionTail(history, 8)
        : history;

  const chip = (
    <span
      className="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/10 px-3 py-1.5 text-[11px] font-medium shadow-sm"
      title="ABŞ fond bazarları (NYSE/NASDAQ) iş saatları"
    >
      <RefreshTimer />
      <span className={marketOpen ? "text-brand-green dark:text-emerald-400" : "text-black/45 dark:text-white/50"}>
        {marketOpen ? "ABŞ bazarları açıqdır" : "ABŞ bazarları bağlıdır"}
      </span>
      <span className="text-black/20 dark:text-white/30">·</span>
      <span className="text-black/45 dark:text-white/50">
        <span className="hidden sm:inline">
          {marketOpen ? "Bağlanmağa" : "Açılmağa"}{" "}
        </span>
        <span className="num tabular-nums text-black/70 dark:text-white/75">
          {formatRemaining(remaining)}
        </span>
        <span className="hidden sm:inline"> qalıb</span>
      </span>
    </span>
  );

  if (!hasHistory) return chip;

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex"
      >
        {chip}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-80 max-w-[85vw] rounded-xl border border-black/10 dark:border-white/15 bg-white/95 dark:bg-neutral-900/95 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.25)] backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/50">
              {range === "daily" ? "Günlük hərəkət" : "Həftəlik hərəkət"}
            </span>
            <span className="flex gap-1">
              {(
                [
                  { key: "daily", label: "Günlük" },
                  { key: "weekly", label: "Həftəlik" },
                ] as const
              ).map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRange(r.key);
                  }}
                  aria-pressed={range === r.key}
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition ${
                    range === r.key
                      ? "border-transparent bg-brand-green/15 text-brand-green dark:text-emerald-400"
                      : "border-black/10 dark:border-white/15 text-black/45 dark:text-white/50 hover:text-black/70 dark:hover:text-white/75"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </span>
          </div>
          <p className="mt-0.5 text-[10px] leading-4 text-black/45 dark:text-white/50">
            Portfelin seansdaxili günlük dəyişimi
            {range === "weekly" ? " — hər gün öz seansından başlayır" : ""}
          </p>

          {points.length >= 2 ? (
            <div className="mt-3">
              <SessionHistoryChart
                points={points}
                color={REGULAR_GREEN}
                labelKind={range === "weekly" ? "datetime" : "time"}
              />
            </div>
          ) : (
            <div className="mt-3 flex h-20 items-center justify-center text-center text-[11px] leading-4 text-black/45 dark:text-white/50">
              Hələ kifayət qədər qeyd yoxdur — qrafik bazar saatlarında
              <br />
              hər 10 dəqiqədən bir yığılan qeydlərdən qurulur.
            </div>
          )}

          <p className="mt-2 text-[10px] text-black/45 dark:text-white/50">
            Hər 10 dəqiqədən bir qeyd olunur.
          </p>
        </div>
      )}
    </span>
  );
}
