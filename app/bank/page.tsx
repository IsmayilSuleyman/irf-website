import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerUser } from "@/lib/supabase/server";
import {
  getBankAccountByName,
  type BankPaymentScheduleItem,
} from "@/lib/bank";
import { MotionSection } from "@/components/MotionSection";
import { BankHeader } from "@/components/BankHeader";

export const dynamic = "force-dynamic";

function displayNameOf(meta: Record<string, unknown> | undefined): string | null {
  if (!meta) return null;

  return (
    (meta.full_name as string) ||
    (meta.name as string) ||
    (meta.display_name as string) ||
    null
  );
}

function formatBakuDate(d: Date): string {
  return new Intl.DateTimeFormat("az-AZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Baku",
  }).format(d);
}

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

function simplifyText(value: string): string {
  return value
    .replace(/[\u018F\u0259]/g, "e")
    .replace(/[\u0049\u0130\u0131\u0069]/g, "i")
    .replace(/[\u00D6\u00F6]/g, "o")
    .replace(/[\u00DC\u00FC]/g, "u")
    .replace(/[\u011E\u011F]/g, "g")
    .replace(/[\u015E\u015F]/g, "s")
    .replace(/[\u00C7\u00E7]/g, "c");
}

function statusStyles(status: string | null | undefined): string {
  const normalized = simplifyText(String(status ?? "")).toLocaleLowerCase("en-US");

  if (normalized.includes("oden") || normalized.includes("paid")) {
    return "bg-[#e9f7ee] text-[#128342]";
  }

  if (normalized.includes("gec") || normalized.includes("late")) {
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
  const { reason, user } = await getSupabaseServerUser();

  if (reason === "missing_config") {
    redirect("/welcome?setup=supabase");
  }

  if (reason === "error") {
    redirect("/login");
  }

  if (!user) {
    redirect("/login?next=/bank");
  }

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

  const maturityEndAmount =
    account.depositedAzn > 0 && account.maturityBonusAzn != null
      ? account.depositedAzn + account.maturityBonusAzn
      : null;

  const depositTermLabel =
    account.termMonths != null ? `${account.termMonths} ay` : "—";

  const remainingPayments =
    account.paymentSchedule.length > 0
      ? account.paymentSchedule.filter(
          (p) =>
            !simplifyText(String(p.status ?? ""))
              .toLocaleLowerCase("en-US")
              .includes("oden") &&
            !simplifyText(String(p.status ?? ""))
              .toLocaleLowerCase("en-US")
              .includes("paid"),
        ).length
      : null;

  return (
    <main className="min-h-screen">
      <BankHeader dateLabel={dateLabel} />

      <section className="mx-auto max-w-[960px] px-5 py-10 sm:py-14">
        <MotionSection>
          <p className="text-sm font-medium tracking-[-0.01em] text-[#2F61D8]">
            Xoş gəlmisən, {account.name}
          </p>
        </MotionSection>

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
