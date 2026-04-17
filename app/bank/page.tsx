import Link from "next/link";
import {
  getBankAccountByName,
  simplifyText,
  type BankPaymentScheduleItem,
} from "@/lib/bank";
import { requireUser } from "@/lib/auth-guard";
import { displayNameOf, formatBakuDate } from "@/lib/user";
import { MotionSection } from "@/components/MotionSection";
import { BankHeader } from "@/components/BankHeader";

export const dynamic = "force-dynamic";

function formatDisplayDate(value: string | null | undefined): string | null {
  if (!value) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? value : formatBakuDate(parsed);
}

function formatAmount(value: number): string {
  const hasFraction = Math.abs(value % 1) > 0.001;

  return new Intl.NumberFormat("az-AZ", {
    maximumFractionDigits: 2,
    minimumFractionDigits: hasFraction ? 2 : 0,
  }).format(value);
}

function formatPercent(value: number | null): string {
  if (value == null) return "—";
  return `${new Intl.NumberFormat("az-AZ", { maximumFractionDigits: 2 }).format(value)}%`;
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
    return "bg-[#e9f7ee] text-[#128342]";
  }

  if (n.includes("gec") || n.includes("late")) {
    return "bg-[#fdecee] text-[#c74252]";
  }

  return "bg-[#eef2fb] text-[#2F61D8]";
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
      ? "text-[#128342]"
      : tone === "negative"
        ? "text-[#c74252]"
        : "text-[#111111]";

  return (
    <div className="rounded-2xl border border-black/6 bg-white/90 px-5 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/42">
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
        <p className="truncate text-sm font-medium text-[#161616]">{dateLabel}</p>
        {item.label ? (
          <p className="mt-0.5 truncate text-xs text-black/48">{item.label}</p>
        ) : null}
      </div>
      <span
        className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusStyles(statusLabel)}`}
      >
        {statusLabel}
      </span>
      <p className="text-sm font-semibold tabular-nums text-[#111111]">{amountLabel}</p>
    </div>
  );
}

function PaymentSchedule({ schedule }: { schedule: BankPaymentScheduleItem[] }) {
  return (
    <section className="rounded-2xl border border-black/6 bg-white/90">
      <header className="flex items-baseline justify-between px-5 py-4">
        <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-[#111111]">
          Ödəniş cədvəli
        </h2>
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-black/42">
          {schedule.length} ödəniş
        </span>
      </header>
      <div className="divide-y divide-black/6 border-t border-black/6">
        {schedule.map((item, index) => (
          <ScheduleRow key={`${item.date}-${index}`} item={item} />
        ))}
      </div>
    </section>
  );
}

export default async function BankPage() {
  const user = await requireUser("/bank");

  const name = displayNameOf(user.user_metadata);
  const account = await getBankAccountByName(name);
  const dateLabel = formatBakuDate(new Date());

  if (!account) {
    return (
      <main className="min-h-screen">
        <BankHeader dateLabel={dateLabel} />
        <section className="mx-auto max-w-[680px] px-5 py-20 text-center sm:py-28">
          <MotionSection>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#18A957]">
              Hesab tapılmadı
            </p>
            <h1 className="mt-4 text-[clamp(1.9rem,3vw,2.5rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-[#111111]">
              Bu giriş hələ bank cədvəlinə bağlanmayıb
            </h1>
            <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-black/54">
              {user.email} hesabı üçün uyğun bank sətri tapılmadı.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
              <Link
                href="/portal"
                className="inline-flex items-center justify-center rounded-xl border border-black/10 bg-white px-5 py-3 text-sm font-medium text-black/66 transition hover:border-[#2F61D8]/30 hover:text-[#2F61D8]"
              >
                Portala qayıt
              </Link>
              <Link
                href="/ismayilbank"
                className="inline-flex items-center justify-center rounded-xl bg-[#2F61D8] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#2854be]"
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

  const maturityEndAmount =
    account.depositedAzn > 0 && account.maturityBonusAzn != null
      ? account.depositedAzn + account.maturityBonusAzn
      : null;

  const depositTermLabel =
    account.termMonths != null ? `${account.termMonths} ay` : "—";

  const remainingPayments =
    account.paymentSchedule.length > 0
      ? account.paymentSchedule.filter((p) => !isPaid(p.status)).length
      : null;

  return (
    <main className="min-h-screen">
      <BankHeader dateLabel={dateLabel} />

      <section className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
        <MotionSection>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#2F61D8]">
            XOŞ GƏLDİN, {account.name}
          </p>
        </MotionSection>

        {/* ── Empty state ── */}
        {hasNoProducts ? (
          <MotionSection delay={0.04}>
            <div className="mt-16 flex flex-col items-start sm:mt-24">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/38">
                Hələlik heç nə yoxdur
              </p>
              <p className="mt-3 max-w-sm text-sm leading-6 text-black/54">
                Depozit və ya kredit məhsullarımızla tanış olmaq üçün kalkulyatora keç.
              </p>
              <Link
                href="/ismayilbank"
                className="mt-6 inline-flex items-center justify-center rounded-xl bg-[#2F61D8] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#2854be]"
              >
                Depozit və kredit şərtlərinə bax
              </Link>
            </div>
          </MotionSection>
        ) : null}

        {/* ── Deposits Section ── */}
        {account.depositedAzn > 0 ? (
          <MotionSection delay={0.04}>
            <h2 className="mt-8 text-[15px] font-semibold tracking-[-0.01em] text-[#111111]">
              İsmayılBank-da olan depozitlərim:
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile
                label="Depozit"
                value={`${formatAmount(account.depositedAzn)}₼`}
              />
              <StatTile
                label="Depozitin müddəti"
                value={depositTermLabel}
              />
              <StatTile
                label="Depozitin illik gəlirlik faizi"
                value={formatPercent(account.annualRatePct)}
              />
              <StatTile label="Müddətin sonunda alacağın məbləğ">
                {maturityEndAmount != null ? (
                  <p className="mt-2 flex items-baseline gap-1.5 font-semibold tracking-[-0.03em]">
                    <span className="text-base text-black/48">{formatAmount(account.depositedAzn)}₼</span>
                    <span className="text-xs text-black/30" aria-hidden>─►</span>
                    <span className="text-[1.35rem] text-[#128342]">{formatAmount(maturityEndAmount)}₼</span>
                  </p>
                ) : (
                  <p className="mt-2 text-[1.35rem] font-semibold tracking-[-0.03em] text-[#111111]">—</p>
                )}
              </StatTile>
            </div>
            <p className="mt-3 text-xs leading-5 text-black/48">
              Qeyd: depozit üzrə hesablanmış faiz yalnız depozit müddətinin
              sonunda{account.maturityDate ? ` (${formatDisplayDate(account.maturityDate)})` : ""} ödənilir.
              Vaxtından əvvəl çıxarılan depozitlərə faiz gəliri verilmir.
            </p>
          </MotionSection>
        ) : null}

        {/* ── Credits Section ── */}
        {account.outstandingLoanAzn > 0 ? (
          <MotionSection delay={0.08}>
            <h2 className="mt-10 text-[15px] font-semibold tracking-[-0.01em] text-[#111111]">
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
      </section>
    </main>
  );
}
