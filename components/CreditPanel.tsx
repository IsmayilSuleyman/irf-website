import { simplifyText } from "@/lib/bankShared";
import type { BankPaymentScheduleItem } from "@/lib/bank";
import { formatGrouped } from "@/lib/portfolio";

// The /bank credit section as ONE story instead of three floating tiles and
// a flat table: how much is left (hero), what happens next (highlighted next
// payment with a countdown), how far along the loan is (per-payment progress
// segments) and the full schedule as a timeline whose dots carry the status,
// so the row pills are no longer needed. Server component — no client JS.

const MS_DAY = 86_400_000;

function formatAmount(value: number): string {
  const hasFraction = Math.abs(value % 1) > 0.001;
  return formatGrouped(value, hasFraction ? 2 : 0);
}

// Hand-rolled "1 sentyabr 2026" — NOT Intl: the panel now also renders
// inside the client personal-debts card, and Intl's az-AZ locale is
// missing from Node's ICU (SSR printed "2026 M09 1" and hydration
// mismatched against the browser's proper output).
const AZ_MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr",
];

function formatDateLabel(value: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (iso) {
    const month = AZ_MONTHS[Number(iso[2]) - 1];
    if (month) return `${Number(iso[3])} ${month} ${iso[1]}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return value;
  // Shift to Baku (fixed UTC+4) before reading calendar parts.
  const baku = new Date(parsed.getTime() + 4 * 3_600_000);
  return `${baku.getUTCDate()} ${AZ_MONTHS[baku.getUTCMonth()]} ${baku.getUTCFullYear()}`;
}

function isPaidStatus(status: string | null | undefined): boolean {
  const n = simplifyText(String(status ?? "")).toLocaleLowerCase("en-US");
  return n.includes("oden") || n.includes("paid");
}

// Whole days from "today" to the due date, both taken as Baku (fixed UTC+4)
// calendar days so the countdown flips at Baku midnight, not UTC's. null for
// unparseable dates.
function daysUntil(date: string, now: Date): number | null {
  const due = new Date(date).getTime();
  if (!Number.isFinite(due)) return null;
  const dayOf = (ms: number) => Math.floor((ms + 4 * 3_600_000) / MS_DAY);
  return dayOf(due) - dayOf(now.getTime());
}

type Row = {
  item: BankPaymentScheduleItem;
  paid: boolean;
  /** The first unpaid payment — the one the countdown points at. */
  isNext: boolean;
  late: boolean;
};

export function CreditPanel({
  outstandingAzn,
  monthlyPaymentAzn,
  schedule,
  title = "İsmayılBank ilə olan kreditim",
}: {
  outstandingAzn: number;
  monthlyPaymentAzn: number | null;
  schedule: BankPaymentScheduleItem[];
  /** Header eyebrow — personal installment debts reuse this panel with
   *  their own name. */
  title?: string;
}) {
  const now = new Date();
  const firstUnpaidIdx = schedule.findIndex((p) => !isPaidStatus(p.status));
  const rows: Row[] = schedule.map((item, i) => {
    const paid = isPaidStatus(item.status);
    const isNext = i === firstUnpaidIdx;
    const d = daysUntil(item.date, now);
    return { item, paid, isNext, late: !paid && d != null && d < 0 };
  });

  const totalAzn = rows.reduce((s, r) => s + (r.item.amountAzn ?? 0), 0);
  const paidAzn = rows.reduce(
    (s, r) => s + (r.paid ? (r.item.amountAzn ?? 0) : 0),
    0,
  );
  const remainingCount = rows.filter((r) => !r.paid).length;
  const paidPct = totalAzn > 0 ? Math.round((paidAzn / totalAzn) * 100) : null;
  const settled = outstandingAzn <= 0 && remainingCount === 0;

  const next = rows.find((r) => r.isNext) ?? null;
  const nextDays = next ? daysUntil(next.item.date, now) : null;
  const nextCountdown =
    nextDays == null
      ? null
      : nextDays < 0
        ? "Gecikir"
        : nextDays === 0
          ? "Bu gün"
          : nextDays === 1
            ? "Sabah"
            : `${nextDays} gün qaldı`;

  return (
    <section className="overflow-hidden rounded-hero border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/10">
      <div className="p-6 sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/50">
            {title}
          </p>
          {settled ? (
            <span className="rounded-full bg-brand-green-mist dark:bg-brand-green/15 px-2.5 py-0.5 text-[11px] font-semibold text-status-paid dark:text-emerald-400">
              Tam ödənildi
            </span>
          ) : paidPct != null ? (
            <span className="whitespace-nowrap rounded-full bg-brand-green-mist dark:bg-brand-green/15 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-status-paid dark:text-emerald-400">
              {paidPct}% ödənilib
            </span>
          ) : null}
        </div>

        {/* Hero row: the remaining debt carries the section; the next payment
            answers the only other question that matters — "what's due, when". */}
        <div className="mt-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
          <div>
            <p
              className={`num text-[2.4rem] font-semibold leading-none tracking-[-0.03em] tabular-nums sm:text-[2.8rem] ${
                settled
                  ? "text-black/35 dark:text-white/40"
                  : "text-ink dark:text-white/90"
              }`}
            >
              {formatAmount(Math.max(0, outstandingAzn))}
              <span className="ml-1 text-[1.4rem] font-medium text-black/40 dark:text-white/45">
                ₼
              </span>
            </p>
            <p className="mt-1.5 text-xs text-black/45 dark:text-white/50">
              {settled ? "kredit bağlanıb" : "qalan borc"}
            </p>
          </div>

          {next ? (
            <div className="flex items-center gap-4 rounded-card border border-bank-blue-ring/60 dark:border-bank-blue/40 bg-bank-blue-soft/60 dark:bg-bank-blue/10 px-4 py-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-bank-blue/80 dark:text-blue-400/80">
                  Növbəti ödəniş
                </p>
                <p className="mt-1 text-sm font-semibold text-ink dark:text-white/90">
                  {formatDateLabel(next.item.date)}
                </p>
              </div>
              <div className="text-right">
                <p className="num text-lg font-semibold tabular-nums text-bank-blue dark:text-blue-400">
                  {next.item.amountAzn != null
                    ? `${formatAmount(next.item.amountAzn)} ₼`
                    : monthlyPaymentAzn != null
                      ? `${formatAmount(monthlyPaymentAzn)} ₼`
                      : "—"}
                </p>
                {nextCountdown ? (
                  <p
                    className={`mt-0.5 text-[11px] font-semibold ${
                      next.late
                        ? "text-status-late dark:text-rose-400"
                        : "text-black/45 dark:text-white/50"
                    }`}
                  >
                    {nextCountdown}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {/* One segment per payment: paid fills green, the next one is blue
            (red when overdue), the rest wait as neutral track. */}
        {rows.length > 0 ? (
          <>
            <div className="mt-6 flex gap-1" aria-hidden>
              {rows.map((r, i) => (
                <span
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${
                    r.paid
                      ? "bg-status-paid dark:bg-emerald-500"
                      : r.isNext
                        ? r.late
                          ? "bg-status-late"
                          : "bg-bank-blue dark:bg-blue-500"
                        : "bg-black/10 dark:bg-white/15"
                  }`}
                />
              ))}
            </div>
            <div className="mt-2.5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 text-[11px] text-black/45 dark:text-white/50">
              <p className="tabular-nums">
                <span className="font-semibold text-status-paid dark:text-emerald-400">
                  {formatAmount(paidAzn)} ₼
                </span>{" "}
                ödənilib · ümumi {formatAmount(totalAzn)} ₼
              </p>
              {!settled ? (
                <p className="tabular-nums">
                  {remainingCount} ödəniş qalıb
                  {monthlyPaymentAzn != null
                    ? ` · ayda ${formatAmount(monthlyPaymentAzn)} ₼`
                    : ""}
                </p>
              ) : null}
            </div>
          </>
        ) : null}
      </div>

      {/* Schedule timeline: the dot IS the status (check = paid, blue ring =
          next, hollow = planned), so rows stay quiet — date left, amount
          right, and only the next row gets a tinted backdrop. */}
      {rows.length > 0 ? (
        <div className="border-t border-black/10 dark:border-white/10 px-6 pb-6 pt-4 sm:px-7">
          <div className="flex items-baseline justify-between">
            <h3 className="text-[13px] font-semibold tracking-[-0.01em] text-ink dark:text-white/90">
              Ödəniş cədvəli
            </h3>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/50">
              {rows.length} ödəniş
            </span>
          </div>
          <ol className="relative mt-3">
            {/* The rail sits behind the dots; top/bottom insets keep it from
                poking past the first and last dot centers. */}
            <span
              aria-hidden
              className="absolute bottom-5 left-[9px] top-5 w-px bg-black/10 dark:bg-white/15"
            />
            {rows.map((r, i) => (
              <li
                key={`${r.item.date}-${i}`}
                className={`relative flex items-center gap-4 py-2.5 ${
                  r.isNext
                    ? "-mx-3 rounded-card bg-bank-blue-soft/60 dark:bg-bank-blue/10 px-3"
                    : ""
                }`}
              >
                <span
                  className={`relative z-10 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full ${
                    r.paid
                      ? "bg-status-paid text-white dark:bg-emerald-500"
                      : r.isNext
                        ? `border-2 bg-white dark:bg-[#101418] ${
                            r.late
                              ? "border-status-late"
                              : "border-bank-blue dark:border-blue-500"
                          }`
                        : "border-2 border-black/15 dark:border-white/20 bg-white dark:bg-[#101418]"
                  }`}
                >
                  {r.paid ? (
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 12 12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M2 6.2 4.8 9 10 3.4" />
                    </svg>
                  ) : r.isNext ? (
                    <span
                      className={`h-[7px] w-[7px] rounded-full ${
                        r.late ? "bg-status-late" : "bg-bank-blue dark:bg-blue-500"
                      }`}
                    />
                  ) : null}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-sm ${
                      r.paid
                        ? "font-medium text-black/45 dark:text-white/50"
                        : "font-semibold text-ink dark:text-white/90"
                    }`}
                  >
                    {formatDateLabel(r.item.date)}
                  </p>
                  {r.item.label ? (
                    <p className="mt-0.5 truncate text-[11px] text-black/40 dark:text-white/40">
                      {r.item.label}
                    </p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p
                    className={`num text-sm font-semibold tabular-nums ${
                      r.paid
                        ? "text-black/40 dark:text-white/45"
                        : "text-ink dark:text-white/90"
                    }`}
                  >
                    {r.item.amountAzn != null
                      ? `${formatAmount(r.item.amountAzn)} ₼`
                      : "—"}
                  </p>
                  <p
                    className={`mt-0.5 text-[10px] font-semibold ${
                      r.paid
                        ? "text-status-paid dark:text-emerald-400"
                        : r.isNext
                          ? r.late
                            ? "text-status-late dark:text-rose-400"
                            : "text-bank-blue dark:text-blue-400"
                          : "text-black/35 dark:text-white/35"
                    }`}
                  >
                    {r.paid
                      ? "Ödənildi"
                      : r.isNext
                        ? r.late
                          ? "Gecikir"
                          : "Növbəti"
                        : "Planlaşdırılır"}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
