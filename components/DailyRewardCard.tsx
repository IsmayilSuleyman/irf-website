"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { claimDailyReward } from "@/app/bank/reward-actions";
import { formatGrouped } from "@/lib/portfolio";
import { DAILY_REWARD_AZN, type DailyRewardState } from "@/lib/dailyReward";

// Günlük mükafat card: sign in, tap, +0,10 ₼. One compact row in the bank
// card language — gift icon, today's status, the last-7-days strip with the
// running streak, and the claim button. The server action + RPC enforce
// one-claim-per-Baku-day; this component only reports and celebrates.

export function DailyRewardCard({ state }: { state: DailyRewardState }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [localClaimed, setLocalClaimed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const claimedToday = state.claimedToday || localClaimed;
  const bump = localClaimed && !state.claimedToday ? DAILY_REWARD_AZN : 0;
  const totalAzn = state.totalAzn + bump;
  const monthAzn = state.monthAzn + bump;
  const streak = claimedToday && !state.claimedToday ? state.streak + 1 : state.streak;
  const today = state.recentDays[state.recentDays.length - 1]?.date;

  const onClaim = () => {
    setError(null);
    startTransition(async () => {
      const res = await claimDailyReward();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setLocalClaimed(true);
      router.refresh();
    });
  };

  return (
    <section className="rounded-hero border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/10 p-5 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-green-mist dark:bg-brand-green/15 text-status-paid dark:text-emerald-400">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="8" width="18" height="4" rx="1" />
            <path d="M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8" />
            <path d="M12 8v13" />
            <path d="M12 8s-4.5-.5-4.5-3A1.9 1.9 0 0 1 9.4 3C11.4 3 12 8 12 8Z" />
            <path d="M12 8s4.5-.5 4.5-3A1.9 1.9 0 0 0 14.6 3C12.6 3 12 8 12 8Z" />
          </svg>
        </span>

        {/* min-w floor (not min-w-0): without it this block shrinks to a
            one-word-per-line sliver on phones instead of letting the
            strip+button cluster wrap to its own row. */}
        <div className="min-w-[11rem] flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/50">
            Günlük mükafat
          </p>
          <p className="mt-1 text-sm font-semibold tracking-[-0.01em] text-ink dark:text-white/90">
            {claimedToday
              ? "Bu gün götürülüb — sabah yenidən gəl"
              : `Bu günün ${formatGrouped(DAILY_REWARD_AZN, 2)} ₼ mükafatı hazırdır`}
          </p>
          <p className="num mt-0.5 text-[11px] tabular-nums text-black/45 dark:text-white/50">
            Cəmi {formatGrouped(totalAzn, 2)} ₼ · bu ay {formatGrouped(monthAzn, 2)} ₼
          </p>
        </div>

        {/* On phones this cluster wraps under the text and spreads across
            the row; on sm+ it sits compact at the card's right edge. */}
        <div className="flex flex-1 items-center justify-between gap-4 sm:flex-none sm:justify-start">
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-1" aria-hidden>
              {state.recentDays.map((d) => {
                const filled = d.claimed || (localClaimed && d.date === today);
                return (
                  <span
                    key={d.date}
                    title={d.date}
                    className={`h-2 w-2 rounded-full ${
                      filled
                        ? "bg-status-paid dark:bg-emerald-400"
                        : "bg-black/10 dark:bg-white/15"
                    } ${d.date === today ? "ring-2 ring-brand-green/30 dark:ring-emerald-400/30" : ""}`}
                  />
                );
              })}
            </div>
            <span className="num text-[10px] font-semibold tabular-nums text-black/45 dark:text-white/50">
              {streak > 0 ? `${streak} gün seriya` : "son 7 gün"}
            </span>
          </div>

          {claimedToday ? (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-brand-green-mist dark:bg-brand-green/15 px-3.5 py-2.5 text-[13px] font-semibold text-status-paid dark:text-emerald-400">
              <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M2 6.2 4.8 9 10 3.4" />
              </svg>
              Götürülüb
            </span>
          ) : (
            <button
              type="button"
              onClick={onClaim}
              disabled={pending}
              className="num inline-flex items-center justify-center rounded-xl bg-brand-green px-4 py-2.5 text-[13px] font-semibold tabular-nums text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-brand-green-deep disabled:cursor-wait disabled:opacity-60"
            >
              {pending
                ? "Götürülür…"
                : `+${formatGrouped(DAILY_REWARD_AZN, 2)} ₼ götür`}
            </button>
          )}
        </div>
      </div>
      {error ? (
        <p className="mt-2 text-[11px] font-medium text-status-late dark:text-rose-400">
          {error}
        </p>
      ) : null}
    </section>
  );
}
