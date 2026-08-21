"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { settleDailyRewards } from "@/app/bank/reward-actions";
import { formatGrouped } from "@/lib/portfolio";
import type { DailyRewardHolderTotal } from "@/lib/dailyReward";

// İsmayıl's settlement view for the daily rewards. The workflow: unsettled
// claims count into the holder's displayed deposit; İsmayıl moves the
// amount into the Sheet deposit, then taps "Hesablaşdır" here — the claims
// get a settled_at stamp and drop out of the displayed figure, so nothing
// double-counts.

export function DailyRewardAdminCard({
  totals,
}: {
  totals: DailyRewardHolderTotal[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyName, setBusyName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const unsettledTotal = totals.reduce((s, t) => s + t.unsettledAzn, 0);

  const onSettle = (name: string, amountAzn: number) => {
    if (
      !window.confirm(
        `${name}: ${formatGrouped(amountAzn, 2)} ₼ Sheet depozitinə köçürüldü? Təsdiqdən sonra bu məbləğ hesablaşmış sayılacaq.`,
      )
    ) {
      return;
    }
    setError(null);
    setBusyName(name);
    startTransition(async () => {
      const res = await settleDailyRewards(name);
      setBusyName(null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/10 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/50">
          Günlük mükafatlar
        </p>
        <span className="num text-sm font-semibold tabular-nums text-ink dark:text-white/90">
          {formatGrouped(unsettledTotal, 2)} ₼ ödənilməmiş
        </span>
      </div>
      <div className="mt-2 divide-y divide-black/5 dark:divide-white/10">
        {totals.map((t) => (
          <div
            key={t.name}
            className="flex items-center justify-between gap-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink dark:text-white/90">
                {t.name}
              </p>
              <p className="mt-0.5 text-[11px] text-black/45 dark:text-white/50">
                <span className="num">{t.claimCount}</span> gün · cəmi{" "}
                <span className="num">{formatGrouped(t.totalAzn, 2)}</span> ₼
                {t.lastClaim ? ` · son: ${t.lastClaim}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2.5">
              <span
                className={`num text-sm font-semibold tabular-nums ${
                  t.unsettledAzn > 0
                    ? "text-status-paid dark:text-emerald-400"
                    : "text-black/40 dark:text-white/45"
                }`}
              >
                {formatGrouped(t.unsettledAzn, 2)} ₼
              </span>
              {t.unsettledAzn > 0 ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onSettle(t.name, t.unsettledAzn)}
                  className="rounded-lg border border-black/10 dark:border-white/15 bg-white/80 dark:bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-black/55 dark:text-white/60 transition hover:border-bank-blue/30 hover:text-bank-blue dark:hover:text-blue-400 disabled:cursor-wait disabled:opacity-60"
                >
                  {pending && busyName === t.name ? "…" : "Hesablaşdır"}
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      {error ? (
        <p className="mt-2 text-[11px] font-medium text-status-late dark:text-rose-400">
          {error}
        </p>
      ) : null}
      <p className="mt-3 text-[11px] leading-5 text-black/45 dark:text-white/50">
        Ödənilməmiş mükafatlar holderin görünən depozitinə daxildir.
        Məbləği Sheet depozitinə köçürəndən sonra "Hesablaşdır" bas — ikiqat
        sayılma olmasın deyə.
      </p>
    </div>
  );
}
