"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatAzn } from "@/lib/portfolio";
import type { PersonalDebt } from "@/lib/personalDebts";
import {
  deletePersonalDebt,
  savePersonalDebt,
  setPersonalDebtPaid,
} from "@/app/bank/personal-debt-actions";

// "Digər borclarım" — the holder's own debts OUTSIDE İsmayılBank
// (utilities, cards, money owed to people). Rows the user adds here turn
// into bell + web-push reminders via the daily cron once the due date
// comes into the chosen window. `todayIso` arrives from the server so the
// relative-day math is identical on server render and hydration.

const REMIND_CHOICES = [
  { days: 0, label: "həmin gün" },
  { days: 1, label: "1 gün əvvəl" },
  { days: 3, label: "3 gün əvvəl" },
  { days: 7, label: "1 həftə əvvəl" },
  { days: 14, label: "2 həftə əvvəl" },
] as const;

function isoToUtcMs(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function daysUntil(dueIso: string, todayIso: string): number | null {
  const due = isoToUtcMs(dueIso);
  const today = isoToUtcMs(todayIso);
  if (due == null || today == null) return null;
  return Math.round((due - today) / 86_400_000);
}

function shortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

function duePill(days: number | null): { text: string; cls: string } {
  if (days == null) return { text: "—", cls: "bg-black/5 text-black/45 dark:bg-white/10 dark:text-white/50" };
  if (days < 0)
    return {
      text: `${-days} gün gecikib`,
      cls: "bg-status-late-soft dark:bg-status-late/20 text-status-late dark:text-rose-400",
    };
  if (days === 0)
    return {
      text: "bu gün",
      cls: "bg-amber-500/15 text-status-warn dark:text-amber-400",
    };
  return {
    text: `${days} gün qalıb`,
    cls: "bg-bank-blue-soft dark:bg-bank-blue/20 text-bank-blue dark:text-blue-400",
  };
}

export function PersonalDebtsCard({
  debts,
  todayIso,
}: {
  debts: PersonalDebt[];
  todayIso: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [remindDays, setRemindDays] = useState(3);
  const [recurring, setRecurring] = useState(false);

  const open = debts.filter((d) => !d.paidAt);
  const settled = debts.filter((d) => d.paidAt);

  const submit = () => {
    setError(null);
    const amt = amount.trim() === "" ? null : Number(amount.replace(",", "."));
    startTransition(async () => {
      const res = await savePersonalDebt({
        title,
        amountAzn: amt != null && Number.isFinite(amt) ? amt : null,
        dueDate,
        remindDaysBefore: remindDays,
        recurringMonthly: recurring,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setTitle("");
      setAmount("");
      setDueDate("");
      setRemindDays(3);
      setRecurring(false);
      setFormOpen(false);
      router.refresh();
    });
  };

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Əməliyyat alınmadı.");
      router.refresh();
    });
  };

  const inputCls =
    "w-full rounded-xl border border-black/10 dark:border-white/15 bg-white/80 dark:bg-white/5 px-3 py-2 text-sm text-ink dark:text-white/90 outline-none transition focus:border-bank-blue/50";

  return (
    <section
      id="xatirlatmalar"
      className="scroll-mt-6 rounded-hero border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/10"
    >
      <header className="flex items-start justify-between gap-4 px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/50">
            Xatırlatmalar
          </p>
          <h2 className="mt-1 text-[15px] font-semibold tracking-[-0.02em] text-ink dark:text-white/90">
            Digər borclarım
          </h2>
          <p className="mt-0.5 text-[11px] text-black/45 dark:text-white/50">
            İsmayılBank-dan kənar borcların — vaxtı yaxınlaşanda zəngə və
            telefona bildiriş gəlir.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen((o) => !o)}
          aria-expanded={formOpen}
          className={`shrink-0 rounded-xl px-3.5 py-2 text-[13px] font-semibold transition ${
            formOpen
              ? "bg-black/5 text-black/55 dark:bg-white/10 dark:text-white/60"
              : "bg-bank-blue text-white hover:bg-bank-blue-deep"
          }`}
        >
          {formOpen ? "Bağla" : "+ Yeni"}
        </button>
      </header>

      {/* Native grid-rows collapse — the house pattern for phones. */}
      <div
        aria-hidden={!formOpen}
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${
          formOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="border-t border-black/10 dark:border-white/10 px-5 py-4 sm:px-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-black/45 dark:text-white/50">
                  Ad
                </span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={80}
                  placeholder="məs. Kommunal, kredit kartı…"
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-black/45 dark:text-white/50">
                  Məbləğ (₼, istəyə bağlı)
                </span>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder="45,50"
                  className={`num ${inputCls}`}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-black/45 dark:text-white/50">
                  Son tarix
                </span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={`num ${inputCls}`}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-black/45 dark:text-white/50">
                  Xatırlat
                </span>
                <select
                  value={remindDays}
                  onChange={(e) => setRemindDays(Number(e.target.value))}
                  className={inputCls}
                >
                  {REMIND_CHOICES.map((c) => (
                    <option key={c.days} value={c.days}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-black/70 dark:text-white/75">
                <input
                  type="checkbox"
                  checked={recurring}
                  onChange={(e) => setRecurring(e.target.checked)}
                  className="h-4 w-4 accent-[#2f61d8]"
                />
                Hər ay təkrarlanır
              </label>
              <button
                type="button"
                onClick={submit}
                disabled={pending || title.trim() === "" || dueDate === ""}
                className="rounded-xl bg-bank-blue px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-bank-blue-deep disabled:opacity-50"
              >
                {pending ? "Saxlanır…" : "Əlavə et"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <p className="border-t border-black/10 dark:border-white/10 px-5 py-2.5 text-[12px] text-status-late dark:text-rose-400 sm:px-6">
          {error}
        </p>
      ) : null}

      {open.length === 0 && settled.length === 0 ? (
        <p className="border-t border-black/10 dark:border-white/10 px-5 py-4 text-sm text-black/45 dark:text-white/50 sm:px-6">
          Hələ xatırlatma yoxdur — «Yeni» ilə ilk borcunu əlavə et.
        </p>
      ) : (
        <div className="divide-y divide-black/5 dark:divide-white/5 border-t border-black/10 dark:border-white/10 pb-1.5 pt-1">
          {open.map((d) => {
            const days = daysUntil(d.dueDate, todayIso);
            const pill = duePill(days);
            return (
              <div key={d.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium text-ink dark:text-white/90">
                    {d.title}
                    {d.recurringMonthly ? (
                      <span
                        title="hər ay təkrarlanır"
                        aria-label="hər ay təkrarlanır"
                        className="text-[11px] text-black/40 dark:text-white/45"
                      >
                        ↻
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-black/45 dark:text-white/50">
                    {shortDate(d.dueDate)}
                    {d.note ? ` · ${d.note}` : ""}
                  </p>
                </div>
                <span
                  className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${pill.cls}`}
                >
                  {pill.text}
                </span>
                {d.amountAzn != null ? (
                  <p className="num hidden shrink-0 text-sm font-semibold tabular-nums text-ink dark:text-white/90 sm:block">
                    {formatAzn(d.amountAzn)}
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => act(() => setPersonalDebtPaid(d.id, true))}
                  title={
                    d.recurringMonthly
                      ? "Ödədim — növbəti aya keçir"
                      : "Ödədim — bağlanır"
                  }
                  className="shrink-0 rounded-lg bg-brand-green-mist px-2.5 py-1 text-[11px] font-semibold text-brand-green-deep transition hover:bg-brand-green/25 disabled:opacity-50 dark:bg-brand-green/15 dark:text-emerald-400"
                >
                  Ödədim
                </button>
                <button
                  type="button"
                  disabled={pending}
                  aria-label={`${d.title} — sil`}
                  onClick={() => {
                    if (window.confirm(`«${d.title}» silinsin?`)) {
                      act(() => deletePersonalDebt(d.id));
                    }
                  }}
                  className="shrink-0 rounded-lg px-1.5 py-1 text-[13px] text-black/35 transition hover:text-status-late dark:text-white/40 dark:hover:text-rose-400"
                >
                  ✕
                </button>
              </div>
            );
          })}
          {settled.map((d) => (
            <div key={d.id} className="flex items-center gap-3 px-5 py-3 opacity-70 sm:px-6">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-black/55 dark:text-white/60">
                  {d.title}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-black/40 dark:text-white/45">
                  {shortDate(d.dueDate)}
                </p>
              </div>
              <span className="inline-flex shrink-0 rounded-full bg-brand-green-mist px-2.5 py-0.5 text-[11px] font-semibold text-status-paid dark:bg-brand-green/15 dark:text-emerald-400">
                Ödənilib
              </span>
              {d.amountAzn != null ? (
                <p className="num hidden shrink-0 text-sm font-semibold tabular-nums text-black/45 dark:text-white/50 sm:block">
                  {formatAzn(d.amountAzn)}
                </p>
              ) : null}
              <button
                type="button"
                disabled={pending}
                aria-label={`${d.title} — sil`}
                onClick={() => act(() => deletePersonalDebt(d.id))}
                className="shrink-0 rounded-lg px-1.5 py-1 text-[13px] text-black/35 transition hover:text-status-late dark:text-white/40 dark:hover:text-rose-400"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
