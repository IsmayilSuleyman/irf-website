"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatAzn } from "@/lib/portfolio";
import type { PersonalDebt } from "@/lib/personalDebts";
import type { BankPaymentScheduleItem } from "@/lib/bank";
import { CreditPanel } from "@/components/CreditPanel";
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

// Month-clamped ISO date arithmetic (Mar 31 − 1 ay → Feb 28/29), matching
// the Postgres interval math the paid-RPC uses.
function addMonthsIso(iso: string, months: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso;
  const first = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1 + months, 1));
  const daysIn = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return new Date(
    Date.UTC(
      first.getUTCFullYear(),
      first.getUTCMonth(),
      Math.min(Number(m[3]), daysIn),
    ),
  )
    .toISOString()
    .slice(0, 10);
}

// Synthesize the CreditPanel schedule from a plan debt: the stored due date
// anchors the NEXT unpaid installment (or the last one, once closed), and
// the rest fan out monthly around it.
function planSchedule(d: PersonalDebt): BankPaymentScheduleItem[] {
  const total = d.installmentsTotal ?? 0;
  const paid = Math.min(d.installmentsPaid, total);
  const anchor = d.paidAt ? total - 1 : paid;
  return Array.from({ length: total }, (_, i) => ({
    date: addMonthsIso(d.dueDate, i - anchor),
    amountAzn: d.amountAzn,
    label: `Taksit ${i + 1}/${total}`,
    status: i < paid ? "Ödənildi" : null,
  }));
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
  const [installments, setInstallments] = useState("");
  // Which plan debt has its CreditPanel-style schedule open.
  const [scheduleOpenId, setScheduleOpenId] = useState<string | null>(null);

  const open = debts.filter((d) => !d.paidAt);
  const settled = debts.filter((d) => d.paidAt);

  const submit = () => {
    setError(null);
    const amt = amount.trim() === "" ? null : Number(amount.replace(",", "."));
    const inst = installments.trim() === "" ? null : Number(installments);
    startTransition(async () => {
      const res = await savePersonalDebt({
        title,
        amountAzn: amt != null && Number.isFinite(amt) ? amt : null,
        dueDate,
        remindDaysBefore: remindDays,
        recurringMonthly: recurring,
        installments: inst,
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
      setInstallments("");
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
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-black/45 dark:text-white/50">
                  Taksit sayı (istəyə bağlı)
                </span>
                <input
                  value={installments}
                  onChange={(e) => setInstallments(e.target.value)}
                  inputMode="numeric"
                  placeholder="məs. 6"
                  className={`num ${inputCls}`}
                />
                <span className="mt-1 block text-[10px] leading-[1.4] text-black/40 dark:text-white/45">
                  aylıq taksit planı — məbləğ bir taksitin ödənişidir, cədvəl
                  görünüşü açılır
                </span>
              </label>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <label
                className={`flex cursor-pointer items-center gap-2 text-[13px] text-black/70 dark:text-white/75 ${
                  installments.trim() !== "" ? "opacity-40" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={recurring && installments.trim() === ""}
                  disabled={installments.trim() !== ""}
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
            const isPlan = d.installmentsTotal != null;
            const scheduleOpen = scheduleOpenId === d.id;
            return (
              <div key={d.id}>
                {/* Phones stack the row: identity line on top, pills +
                    actions on their own line beneath (the single-line grid
                    left ~20px for the title). One line again from sm up. */}
                <div className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-6">
                  <div className="min-w-0 sm:flex-1">
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
                      {isPlan ? (
                        <span className="num shrink-0 rounded-md bg-bank-blue-soft px-1.5 py-px text-[10px] font-semibold text-bank-blue dark:bg-bank-blue/20 dark:text-blue-400">
                          taksit {d.installmentsPaid}/{d.installmentsTotal}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-black/45 dark:text-white/50">
                      {shortDate(d.dueDate)}
                      {d.note ? ` · ${d.note}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <span
                      className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${pill.cls}`}
                    >
                      {pill.text}
                    </span>
                    {d.amountAzn != null ? (
                      <p className="num shrink-0 text-sm font-semibold tabular-nums text-ink dark:text-white/90">
                        {formatAzn(d.amountAzn)}
                      </p>
                    ) : null}
                    <span className="ml-auto flex items-center gap-2 sm:ml-0 sm:gap-3">
                      {isPlan ? (
                        <button
                          type="button"
                          onClick={() =>
                            setScheduleOpenId((k) => (k === d.id ? null : d.id))
                          }
                          aria-expanded={scheduleOpen}
                          className={`shrink-0 rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${
                            scheduleOpen
                              ? "border-transparent bg-bank-blue-soft text-bank-blue dark:bg-bank-blue/20 dark:text-blue-400"
                              : "border-black/10 text-black/45 hover:text-bank-blue dark:border-white/15 dark:text-white/50 dark:hover:text-blue-400"
                          }`}
                        >
                          Cədvəl {scheduleOpen ? "▴" : "▾"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => act(() => setPersonalDebtPaid(d.id, true))}
                        title={
                          isPlan
                            ? "Ödədim — bir taksit sayılır"
                            : d.recurringMonthly
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
                    </span>
                  </div>
                </div>
                {/* The CreditPanel-style schedule view for installment
                    plans — the exact loan panel, reused with the debt's
                    own name. Native grid-rows collapse. */}
                {isPlan ? (
                  <div
                    aria-hidden={!scheduleOpen}
                    className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${
                      scheduleOpen
                        ? "grid-rows-[1fr] opacity-100"
                        : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="min-h-0 overflow-hidden">
                      <div className="px-3 pb-4 pt-1 sm:px-4">
                        <CreditPanel
                          title={d.title}
                          outstandingAzn={
                            ((d.installmentsTotal ?? 0) - d.installmentsPaid) *
                            (d.amountAzn ?? 0)
                          }
                          monthlyPaymentAzn={d.amountAzn}
                          schedule={planSchedule(d)}
                        />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
          {settled.map((d) => (
            <div
              key={d.id}
              className="flex flex-col gap-2 px-5 py-3 opacity-70 sm:flex-row sm:items-center sm:gap-3 sm:px-6"
            >
              <div className="min-w-0 sm:flex-1">
                <p className="truncate text-sm font-medium text-black/55 dark:text-white/60">
                  {d.title}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-black/40 dark:text-white/45">
                  {shortDate(d.dueDate)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="inline-flex shrink-0 rounded-full bg-brand-green-mist px-2.5 py-0.5 text-[11px] font-semibold text-status-paid dark:bg-brand-green/15 dark:text-emerald-400">
                  Ödənilib
                </span>
                {d.amountAzn != null ? (
                  <p className="num shrink-0 text-sm font-semibold tabular-nums text-black/45 dark:text-white/50">
                    {formatAzn(d.amountAzn)}
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={pending}
                  aria-label={`${d.title} — sil`}
                  onClick={() => act(() => deletePersonalDebt(d.id))}
                  className="ml-auto shrink-0 rounded-lg px-1.5 py-1 text-[13px] text-black/35 transition hover:text-status-late dark:text-white/40 dark:hover:text-rose-400 sm:ml-0"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
