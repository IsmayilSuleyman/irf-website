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
import { getBankProductTerms } from "@/lib/bankTerms";
import { getBondFundingAzn } from "@/lib/bonds";
import { MotionSection } from "@/components/MotionSection";
import { BankHeader } from "@/components/BankHeader";
import { BankViewToggle } from "@/components/BankViewToggle";
import { BankWideView } from "@/components/BankWideView";
import { BankTermsPanel } from "@/components/BankTermsPanel";
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
    return "bg-brand-green-mist dark:bg-brand-green/15 text-status-paid dark:text-emerald-400";
  }

  if (n.includes("gec") || n.includes("late")) {
    return "bg-status-late-soft dark:bg-status-late/20 text-status-late dark:text-rose-400";
  }

  return "bg-bank-blue-soft dark:bg-bank-blue/20 text-bank-blue dark:text-blue-400";
}

// Bank-app style quick actions: the bank's products/venues one tap away.
// Positioned right under the welcome line so primary navigation no longer
// hides at the bottom of the page. "Depozitlərim" / "Kreditlərim" jump to
// the matching sections further down and only show when the account
// actually has that product.
function QuickActions({
  hasDeposit,
  hasCredit,
}: {
  hasDeposit: boolean;
  hasCredit: boolean;
}) {
  const actions = [
    ...(hasDeposit
      ? [
          {
            href: "#depozitlerim",
            label: "Depozitlərim",
            desc: "Depozit balansım və şərtləri",
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <circle cx="12" cy="12" r="3.5" />
                <path d="M12 10.2v1.8l1.2 1.2" />
              </svg>
            ),
          },
        ]
      : []),
    ...(hasCredit
      ? [
          {
            href: "#kreditlerim",
            label: "Kreditlərim",
            desc: "Kredit qalığı və ödəniş cədvəli",
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M3 10h18" />
                <path d="M7 15h4" />
              </svg>
            ),
          },
        ]
      : []),
    {
      href: "/bonds",
      label: "İstiqrazlar",
      desc: "Kupon istiqrazları al və sat",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 7h8M8 11h8M8 15h4" />
          <circle cx="16" cy="16.5" r="1.6" />
        </svg>
      ),
    },
    {
      href: "/market",
      label: "Bazar",
      desc: "Fond paylarının alqı-satqısı",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 4v16m0-16L3 8m4-4 4 4" />
          <path d="M17 20V4m0 16 4-4m-4 4-4-4" />
        </svg>
      ),
    },
    {
      href: "/ismayilbank",
      label: "Kalkulyator",
      desc: "Kredit və depozit şərtləri",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M9 7h6M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01" />
        </svg>
      ),
    },
  ];

  // Flex-wrap instead of a fixed grid so 3, 4 or 5 cards all fill the row.
  return (
    <div className="mt-6 flex flex-wrap gap-3">
      {actions.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className="group flex min-w-[8.5rem] flex-1 basis-[calc(33%-0.75rem)] flex-col gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/10 px-4 py-4 transition hover:-translate-y-0.5 hover:border-bank-blue/30 hover:shadow-sm sm:basis-0 sm:px-5"
        >
          <span className="text-bank-blue dark:text-blue-400">{a.icon}</span>
          <span className="text-sm font-semibold tracking-[-0.02em] text-ink dark:text-white/90">
            {a.label}
          </span>
          <span className="hidden text-[11px] leading-4 text-black/45 dark:text-white/50 sm:block">
            {a.desc}
          </span>
        </Link>
      ))}
    </div>
  );
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
      ? "text-status-paid dark:text-emerald-400"
      : tone === "negative"
        ? "text-status-late dark:text-rose-400"
        : "text-ink dark:text-white/90";

  return (
    <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/10 px-5 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/50">
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
        <p className="truncate text-sm font-medium text-ink dark:text-white/90">{dateLabel}</p>
        {item.label ? (
          <p className="mt-0.5 truncate text-xs text-black/45 dark:text-white/50">{item.label}</p>
        ) : null}
      </div>
      <span
        className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusStyles(statusLabel)}`}
      >
        {statusLabel}
      </span>
      <p className="text-sm font-semibold tabular-nums text-ink dark:text-white/90">{amountLabel}</p>
    </div>
  );
}

function PaymentSchedule({ schedule }: { schedule: BankPaymentScheduleItem[] }) {
  return (
    <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/10">
      <header className="flex items-baseline justify-between px-5 py-4">
        <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-ink dark:text-white/90">
          Ödəniş cədvəli
        </h2>
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/50">
          {schedule.length} ödəniş
        </span>
      </header>
      <div className="divide-y divide-black/5 border-t border-black/10 dark:border-white/10">
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
    const [accounts, bondFundingAzn] = await Promise.all([
      getBankAccounts(),
      getBondFundingAzn(),
    ]);
    const aggregate = computeBankWide(accounts, new Date(), bondFundingAzn);
    return (
      <main className="min-h-screen bg-bank-section">
        <BankHeader dateLabel={dateLabel} />
        <section className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
          <div className="hidden justify-end sm:-mb-6 sm:flex">
            <BankViewToggle active={bankView} />
          </div>
          <MotionSection>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-bank-blue dark:text-blue-400">
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
  const productTerms = isAdmin ? await getBankProductTerms() : null;

  if (!account) {
    return (
      <main className="min-h-screen bg-bank-section">
        <BankHeader dateLabel={dateLabel} />
        <div className="mx-auto flex max-w-5xl justify-end px-6 pt-6">
          <BankViewToggle active={bankView} />
        </div>
        <section className="mx-auto max-w-[680px] px-5 py-20 text-center sm:py-28">
          <MotionSection>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-green dark:text-emerald-400">
              Hesab tapılmadı
            </p>
            <h1 className="mt-4 text-[clamp(1.9rem,3vw,2.5rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-ink dark:text-white/90">
              Bu giriş hələ bank cədvəlinə bağlanmayıb
            </h1>
            <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-black/55 dark:text-white/60">
              {user.email} hesabı üçün uyğun bank sətri tapılmadı.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
              <Link
                href="/portal"
                className="inline-flex items-center justify-center rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-white/10 px-5 py-3 text-sm font-medium text-black/70 dark:text-white/75 transition hover:border-bank-blue/30 hover:text-bank-blue dark:hover:text-blue-400"
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
        <MotionSection>
          {/* The toggle lives inside the greeting row (not a negative-margin
              overlay) so it can never collide with the quick-actions cards. */}
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-bank-blue dark:text-blue-400">
              XOŞ GƏLDİN, {account.name}
            </p>
            <BankViewToggle active={bankView} compact className="sm:hidden" />
            <BankViewToggle active={bankView} className="hidden sm:inline-flex" />
          </div>
        </MotionSection>

        <MotionSection delay={0.02}>
          <QuickActions
            hasDeposit={account.depositedAzn > 0}
            hasCredit={account.outstandingLoanAzn > 0 || account.paymentSchedule.length > 0}
          />
        </MotionSection>

        {/* ── Empty state ── */}
        {hasNoProducts ? (
          <MotionSection delay={0.04}>
            <div className="mt-16 flex flex-col items-start sm:mt-24">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/50">
                Hələlik heç nə yoxdur
              </p>
              <p className="mt-3 max-w-sm text-sm leading-6 text-black/55 dark:text-white/60">
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
            <div id="depozitlerim" className="mt-8 scroll-mt-6">
              <DepositHero
                depositedAzn={account.depositedAzn}
                termMonths={account.termMonths}
                annualRatePct={account.annualRatePct}
                maturityBonusAzn={account.maturityBonusAzn}
                maturityDate={account.maturityDate}
              />
            </div>
            <p className="mt-4 text-xs leading-5 text-black/45 dark:text-white/50">
              Qeyd: depozit üzrə hesablanmış faiz yalnız depozit müddətinin
              sonunda{account.maturityDate ? ` (${formatDisplayDate(account.maturityDate)})` : ""} ödənilir.
              Vaxtından əvvəl çıxarılan depozitlərə faiz gəliri verilmir.
            </p>
          </MotionSection>
        ) : null}

        {/* ── Credits Section ── */}
        {account.outstandingLoanAzn > 0 ? (
          <MotionSection delay={0.08}>
            <h2
              id="kreditlerim"
              className="mt-10 scroll-mt-6 text-[15px] font-semibold tracking-[-0.01em] text-ink dark:text-white/90"
            >
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
            {/* When the loan is fully paid the credits heading above doesn't
                render, so the schedule card carries the anchor instead. */}
            <div
              id={account.outstandingLoanAzn > 0 ? undefined : "kreditlerim"}
              className="mt-6 scroll-mt-6"
            >
              <PaymentSchedule schedule={account.paymentSchedule} />
            </div>
          </MotionSection>
        ) : null}

        {isAdmin ? (
          <MotionSection delay={0.16}>
            <div className="mt-12">
              <div className="flex items-center gap-3">
                <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink dark:text-white/90">
                  İdarəetmə
                </h2>
                <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <DebtNoticePanel debtors={debtors} />
                <BroadcastPanel recipients={recipientNames} />
              </div>
              {productTerms ? (
                <div className="mt-4">
                  <BankTermsPanel initial={productTerms} />
                </div>
              ) : null}
            </div>
          </MotionSection>
        ) : null}
      </section>
    </main>
  );
}
