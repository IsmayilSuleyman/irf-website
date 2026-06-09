import Link from "next/link";
import {
  computeBankWide,
  getBankAccountByName,
  getBankAccounts,
  simplifyText,
  type BankPaymentScheduleItem,
} from "@/lib/bank";
import { requireUser } from "@/lib/auth-guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { displayNameOf, formatBakuDate } from "@/lib/user";
import { formatGrouped } from "@/lib/portfolio";
import { MotionSection } from "@/components/MotionSection";
import { BankHeader } from "@/components/BankHeader";
import { BankViewToggle } from "@/components/BankViewToggle";
import { BankWideView } from "@/components/BankWideView";
import { DepositHero } from "@/components/DepositHero";
import { DebtNoticePanel } from "@/components/DebtNoticePanel";
import { BroadcastPanel } from "@/components/BroadcastPanel";

export const dynamic = "force-dynamic";

function formatDisplayDate(value: string | null | undefined): string | null {
  if (!value) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? value : formatBakuDate(parsed);
}

function formatAmount(value: number): string {
  const hasFraction = Math.abs(value % 1) > 0.001;
  return formatGrouped(value, hasFraction ? 2 : 0);
}

function normalizeStatus(status: string | null | undefined): string {
  return simplifyText(String(status ?? "")).toLocaleLowerCase("en-US");
}

function isPaid(status: string | null | undefined): boolean {
  const n = normalizeStatus(status);
  return n.includes("oden") || n.includes("paid");
}

function statusStyles(status: string | null | undefined): string {
  const n = normalizeStatus(status);

  if (n.includes("oden") || n.includes("paid")) {
    return "bg-brand-green-mist text-status-paid";
  }

  if (n.includes("gec") || n.includes("late")) {
    return "bg-status-late-soft text-status-late";
  }

  return "bg-bank-blue-soft text-bank-blue";
}

function StatTile({
  label,
  value,
  children,
  tone = "default",
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
  tone?: "default" | "positive" | "negative";
}) {
  const valueTone =
    tone === "positive"
      ? "text-status-paid"
      : tone === "negative"
        ? "text-status-late"
        : "text-ink";

  return (
    <div className="rounded-2xl border border-black/8 bg-white/90 px-5 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45">
        {label}
      </p>
      {children ?? (
        <p className={`mt-2 text-[1.35rem] font-semibold tracking-[-0.03em] ${valueTone}`}>
          {value}
        </p>
      )}
    </div>
  );
}

function ScheduleRow({ item }: { item: BankPaymentScheduleItem }) {
  const amountLabel = item.amountAzn != null ? `${formatAmount(item.amountAzn)} ₼` : "—";
  const statusLabel = item.status || "Planlaşdırılır";
  const dateLabel = formatDisplayDate(item.date) ?? item.date;

  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-3.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink">{dateLabel}</p>
        {item.label ? (
          <p className="mt-0.5 truncate text-xs text-black/45">{item.label}</p>
        ) : null}
      </div>
      <span
        className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusStyles(statusLabel)}`}
      >
        {statusLabel}
      </span>
      <p className="text-sm font-semibold tabular-nums text-ink">{amountLabel}</p>
    </div>
  );
}

function PaymentSchedule({ schedule }: { schedule: BankPaymentScheduleItem[] }) {
  return (
    <section className="rounded-2xl border border-black/8 bg-white/90">
      <header className="flex items-baseline justify-between px-5 py-4">
        <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-ink">
          Ödəniş cədvəli
        </h2>
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45">
          {schedule.length} ödəniş
        </span>
      </header>
      <div className="divide-y divide-black/6 border-t border-black/8">
        {schedule.map((item, index) => (
          <ScheduleRow key={`${item.date}-${index}`} item={item} />
        ))}
      </div>
    </section>
  );
}

export default async function BankPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireUser("/bank");
  const sp = await searchParams;
  // Bank-wide transparency view, available to every signed-in user. Encoded in
  // the URL (?view=bank) so the server renders the right dataset and the state
  // survives refreshes — mirrors FundViewToggle on /dashboard.
  const bankView = sp?.view === "bank";
  const dateLabel = formatBakuDate(new Date());

  if (bankView) {
    const accounts = await getBankAccounts();
    const aggregate = computeBankWide(accounts, new Date());
    return (
      <main className="min-h-screen bg-bank-section">
        <BankHeader dateLabel={dateLabel} />
        <section className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
          <div className="hidden justify-end sm:-mb-6 sm:flex">
            <BankViewToggle active={bankView} />
          </div>
          <MotionSection>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-bank-blue">
                ÜMUMBANK BAXIŞI
              </p>
              <BankViewToggle active={bankView} compact className="sm:hidden" />
            </div>
          </MotionSection>
          <MotionSection delay={0.04}>
            <BankWideView aggregate={aggregate} />
          </MotionSection>
        </section>
      </main>
    );
  }

  const name = displayNameOf(user.user_metadata);
  const account = await getBankAccountByName(name);

  // Admin (is_fund_admin) can push on-demand "pay your debt" notices to borrowers.
  const supabase = await createSupabaseServerClient();
  const isAdmin = supabase
    ? (await supabase.rpc("is_fund_admin")).data === true
    : false;
  const adminAccounts = isAdmin ? await getBankAccounts() : [];
  const debtors = adminAccounts
    .filter((a) => a.outstandingLoanAzn > 0)
    .map((a) => ({ name: a.name, amount: a.outstandingLoanAzn }));
  const recipientNames = adminAccounts.map((a) => a.name);

  if (!account) {
    return (
      <main className="min-h-screen bg-bank-section">
        <BankHeader dateLabel={dateLabel} />
        <div className="mx-auto flex max-w-5xl justify-end px-6 pt-6">
          <BankViewToggle active={bankView} />
        </div>
        <section className="mx-auto max-w-[680px] px-5 py-20 text-center sm:py-28">
          <MotionSection>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-green">
              Hesab tapılmadı
            </p>
            <h1 className="mt-4 text-[clamp(1.9rem,3vw,2.5rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-ink">
              Bu giriş hələ bank cədvəlinə bağlanmayıb
            </h1>
            <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-black/55">
              {user.email} hesabı üçün uyğun bank sətri tapılmadı.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
              <Link
                href="/portal"
                className="inline-flex items-center justify-center rounded-xl border border-black/12 bg-white px-5 py-3 text-sm font-medium text-black/70 transition hover:border-bank-blue/30 hover:text-bank-blue"
              >
                Portala qayıt
              </Link>
              <Link
                href="/ismayilbank"
                className="inline-flex items-center justify-center rounded-xl bg-bank-blue px-5 py-3 text-sm font-medium text-white transition hover:bg-bank-blue-deep"
              >
                Kalkulyatora keç
              </Link>
            </div>
          </MotionSection>
        </section>
      </main>
    );
  }

  const hasNoProducts =
    account.depositedAzn <= 0 &&
    account.outstandingLoanAzn <= 0 &&
    account.paymentSchedule.length === 0;

  const remainingPayments =
    account.paymentSchedule.length > 0
      ? account.paymentSchedule.filter((p) => !isPaid(p.status)).length
      : null;

  return (
    <main className="min-h-screen bg-bank-section">
      <BankHeader dateLabel={dateLabel} />

      <section className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
        <div className="hidden justify-end sm:-mb-12 sm:flex">
          <BankViewToggle active={bankView} />
        </div>
        <MotionSection>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-bank-blue">
              XOŞ GƏLDİN, {account.name}
            </p>
            <BankViewToggle active={bankView} compact className="sm:hidden" />
          </div>
        </MotionSection>

        {/* ── Empty state ── */}
        {hasNoProducts ? (
          <MotionSection delay={0.04}>
            <div className="mt-16 flex flex-col items-start sm:mt-24">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/35">
                Hələlik heç nə yoxdur
              </p>
              <p className="mt-3 max-w-sm text-sm leading-6 text-black/55">
                Depozit və ya kredit məhsullarımızla tanış olmaq üçün kalkulyatora keç.
              </p>
              <Link
                href="/ismayilbank"
                className="mt-6 inline-flex items-center justify-center rounded-xl bg-bank-blue px-5 py-3 text-sm font-medium text-white transition hover:bg-bank-blue-deep"
              >
                Depozit və kredit şərtlərinə bax
              </Link>
            </div>
          </MotionSection>
        ) : null}

        {/* ── Deposits Section — Fund-hero style headline ── */}
        {account.depositedAzn > 0 ? (
          <MotionSection delay={0.04}>
            <div className="mt-8">
              <DepositHero
                depositedAzn={account.depositedAzn}
                termMonths={account.termMonths}
                annualRatePct={account.annualRatePct}
                maturityBonusAzn={account.maturityBonusAzn}
                maturityDate={account.maturityDate}
              />
            </div>
            <p className="mt-4 text-xs leading-5 text-black/45">
              Qeyd: depozit üzrə hesablanmış faiz yalnız depozit müddətinin
              sonunda{account.maturityDate ? ` (${formatDisplayDate(account.maturityDate)})` : ""} ödənilir.
              Vaxtından əvvəl çıxarılan depozitlərə faiz gəliri verilmir.
            </p>
          </MotionSection>
        ) : null}

        {/* ── Credits Section ── */}
        {account.outstandingLoanAzn > 0 ? (
          <MotionSection delay={0.08}>
            <h2 className="mt-10 text-[15px] font-semibold tracking-[-0.01em] text-ink">
              İsmayılBank ilə olan kreditlərim:
            </h2>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <StatTile
                label="Qalan kredit məbləği"
                value={`${formatAmount(account.outstandingLoanAzn)}₼`}
                tone="negative"
              />
              <StatTile
                label="Qalan ödəniş sayı (ay)"
                value={
                  remainingPayments != null
                    ? `${remainingPayments} (ay)`
                    : "—"
                }
              />
              <StatTile
                label="Aylıq ödəniləcək məbləğ"
                value={
                  account.monthlyPaymentAzn != null
                    ? `${formatAmount(account.monthlyPaymentAzn)}₼`
                    : "—"
                }
              />
            </div>
          </MotionSection>
        ) : null}

        {account.paymentSchedule.length > 0 ? (
          <MotionSection delay={0.12}>
            <div className="mt-6">
              <PaymentSchedule schedule={account.paymentSchedule} />
            </div>
          </MotionSection>
        ) : null}

        {isAdmin ? (
          <MotionSection delay={0.16}>
            <div className="mt-8 flex flex-col gap-4">
              <DebtNoticePanel debtors={debtors} />
              <BroadcastPanel recipients={recipientNames} />
            </div>
          </MotionSection>
        ) : null}
      </section>
    </main>
  );
}
