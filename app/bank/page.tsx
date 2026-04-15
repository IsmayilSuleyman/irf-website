import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getBankAccountByName,
  type BankAccount,
  type BankPaymentScheduleItem,
} from "@/lib/bank";
import { formatAzn } from "@/lib/portfolio";
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

function formatStatementAmount(value: number): string {
  const hasFraction = Math.abs(value % 1) > 0.001;

  return new Intl.NumberFormat("az-AZ", {
    maximumFractionDigits: 2,
    minimumFractionDigits: hasFraction ? 2 : 0,
  }).format(value);
}

function formatPercentLabel(value: number | null): string | null {
  if (value == null) return null;

  return `${new Intl.NumberFormat("az-AZ", {
    maximumFractionDigits: 2,
  }).format(value)}%`;
}

function joinParts(parts: Array<string | null | undefined>): string | null {
  const filtered = parts.filter(Boolean) as string[];
  return filtered.length > 0 ? filtered.join(", ") : null;
}

function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
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
    return "border-[#b7e4c5] bg-[#effaf2] text-[#128342]";
  }

  if (normalized.includes("gec") || normalized.includes("late")) {
    return "border-[#f2b9bf] bg-[#fff3f4] text-[#c74252]";
  }

  return "border-[#bfd1fb] bg-[#f3f7ff] text-[#2F61D8]";
}

function AccentMark({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-7 w-7 shrink-0 rounded-[0.35rem] border-[5px] border-[#141414] bg-[#F16E73] shadow-[0_10px_24px_rgba(241,110,115,0.18)] ${className}`}
    />
  );
}

function SummaryTile({
  label,
  tone = "neutral",
  value,
}: {
  label: string;
  tone?: "neutral" | "positive" | "negative";
  value: string;
}) {
  const toneClass =
    tone === "positive"
      ? "text-[#15944a]"
      : tone === "negative"
        ? "text-[#c74252]"
        : "text-[#161616]";

  return (
    <div className="rounded-[1.4rem] border border-black/8 bg-white/86 p-4 shadow-[0_14px_36px_rgba(52,86,63,0.06)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-black/42">
        {label}
      </p>
      <p className={`mt-2 text-[1.4rem] font-black tracking-[-0.06em] ${toneClass}`}>
        {value}
      </p>
    </div>
  );
}

function StatementCard({
  amount,
  detail,
  footnote,
  title,
}: {
  amount: number;
  detail?: string | null;
  footnote?: string | null;
  title: string;
}) {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-[#d7e7da] bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(247,252,249,0.96))] p-5 shadow-[0_22px_70px_rgba(61,104,72,0.08)] sm:p-8 lg:p-10">
      <div className="flex items-start gap-4">
        <AccentMark className="mt-1" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[clamp(1.9rem,3.3vw,3.15rem)] font-black leading-[0.95] tracking-[-0.07em] text-[#151515]">
            {title}
          </h2>

          <div className="mt-5 flex flex-wrap items-end gap-x-2 gap-y-3 leading-none">
            <span className="num text-[clamp(3.8rem,13vw,8.4rem)] font-black tracking-[-0.11em] text-[#111111]">
              {formatStatementAmount(amount)}
            </span>
            <span className="pb-1 text-[clamp(2.8rem,8vw,5.2rem)] font-black tracking-[-0.09em] text-[#111111]">
              {"\u20BC"}
            </span>
          </div>

          {detail ? (
            <p className="mt-5 text-[1rem] leading-7 tracking-[-0.02em] text-[#1b1b1b]/88 sm:text-[1.08rem]">
              {detail}
            </p>
          ) : null}

          {footnote ? (
            <p className="mt-1 text-[0.98rem] leading-7 tracking-[-0.02em] text-black/38">
              {footnote}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ScheduleRow({ item }: { item: BankPaymentScheduleItem }) {
  const amountLabel = item.amountAzn != null ? formatAzn(item.amountAzn) : "Dəqiqləşəcək";
  const statusLabel = item.status || "Planlaşdırılır";
  const noteLabel = item.label || "Məlumat əlavə olunmayıb";

  return (
    <div className="grid gap-3 px-5 py-4 md:grid-cols-[1.1fr_0.85fr_0.9fr_1fr] md:items-center md:px-6">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-black/35 md:hidden">
          Tarix
        </p>
        <p className="text-[1.02rem] font-semibold tracking-[-0.03em] text-[#161616]">
          {formatDisplayDate(item.date) ?? item.date}
        </p>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-black/35 md:hidden">
          Məbləğ
        </p>
        <p className="text-[1.02rem] font-semibold tracking-[-0.03em] text-[#161616]">
          {amountLabel}
        </p>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-black/35 md:hidden">
          Status
        </p>
        <span
          className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold tracking-[-0.02em] ${statusStyles(statusLabel)}`}
        >
          {statusLabel}
        </span>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-black/35 md:hidden">
          Qeyd
        </p>
        <p className="text-sm leading-6 text-black/52">{noteLabel}</p>
      </div>
    </div>
  );
}

function PaymentSchedule({ account }: { account: BankAccount }) {
  const schedule = account.paymentSchedule;
  const showTable = schedule.length > 0;
  const nextPaymentLabel = formatDisplayDate(account.nextPaymentDate) ?? "Əlavə ediləcək";
  const monthlyPaymentLabel =
    account.monthlyPaymentAzn != null ? formatAzn(account.monthlyPaymentAzn) : "Əlavə ediləcək";
  const description = showTable
    ? "Aşağıdakı sətirlər bank cədvəlində verilən növbəti ödənişləri göstərir."
    : account.outstandingLoanAzn > 0
      ? "Aktiv kredit görünür, amma tam cədvəl hələ əlavə olunmayıb. `payment_schedule`, `monthly_payment_azn` və `next_payment_date` sütunları daxil ediləndə bu blok avtomatik dolacaq."
      : "Hazırda aktiv kredit olmadığı üçün ödəniş cədvəli boşdur.";

  return (
    <section className="rounded-[2rem] border border-[#d7e7da] bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(246,252,248,0.96))] p-5 shadow-[0_22px_70px_rgba(61,104,72,0.08)] sm:p-8 lg:p-10">
      <div className="flex items-start gap-4">
        <AccentMark className="mt-1" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-black/42">
            Ödəniş cədvəli
          </p>
          <h2 className="mt-2 text-[clamp(1.9rem,3.2vw,3rem)] font-black leading-[0.95] tracking-[-0.07em] text-[#151515]">
            Kredit ödəniş planı
          </h2>
          <p className="mt-4 max-w-4xl text-[1rem] leading-7 tracking-[-0.02em] text-black/54">
            {description}
          </p>
        </div>
      </div>

      {showTable ? (
        <div className="mt-8 overflow-hidden rounded-[1.5rem] border border-black/8 bg-white/92 shadow-[0_14px_40px_rgba(61,104,72,0.06)]">
          <div className="hidden grid-cols-[1.1fr_0.85fr_0.9fr_1fr] gap-4 border-b border-black/8 px-6 py-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-black/40 md:grid">
            <span>Tarix</span>
            <span>Məbləğ</span>
            <span>Status</span>
            <span>Qeyd</span>
          </div>

          <div className="divide-y divide-black/6">
            {schedule.map((item, index) => (
              <ScheduleRow key={`${item.date}-${index}`} item={item} />
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <SummaryTile
            label="Qalıq borc"
            tone={account.outstandingLoanAzn > 0 ? "negative" : "neutral"}
            value={formatAzn(account.outstandingLoanAzn)}
          />
          <SummaryTile label="Aylıq ödəniş" value={monthlyPaymentLabel} />
          <SummaryTile label="Növbəti tarix" value={nextPaymentLabel} />
        </div>
      )}
    </section>
  );
}

export default async function BankPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/bank");
  }

  const name = displayNameOf(user.user_metadata);
  const account = await getBankAccountByName(name);
  const dateLabel = formatBakuDate(new Date());

  if (!account) {
    return (
      <main className="min-h-screen px-2 py-2 sm:px-4 sm:py-4">
        <section className="mx-auto max-w-[1400px] overflow-hidden rounded-[2rem] border border-black/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.84),rgba(243,250,246,0.94)_50%,rgba(231,245,236,0.96))] shadow-[0_28px_90px_rgba(48,94,63,0.08)]">
          <BankHeader dateLabel={dateLabel} />

          <div className="px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
            <MotionSection className="mx-auto max-w-3xl rounded-[2rem] border border-[#d7e7da] bg-white/86 p-8 text-center shadow-[0_22px_70px_rgba(61,104,72,0.08)] sm:p-10">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#18A957]">
                Bank hesabı tapılmadı
              </p>
              <h1 className="mt-4 text-[clamp(2.5rem,5vw,4.6rem)] font-black leading-[0.95] tracking-[-0.08em] text-[#161616]">
                Bu giriş hələ bank cədvəlinə bağlanmayıb
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-[1rem] leading-7 tracking-[-0.02em] text-black/54">
                {user.email} hesabı üçün uyğun bank sətri tapılmadı. `user_metadata.full_name`
                dəyəri bank sheet-dəki adla eyni olmalıdır.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  href="/portal"
                  className="inline-flex items-center justify-center rounded-[1rem] border border-black/10 bg-white/84 px-6 py-4 text-sm font-semibold tracking-[-0.03em] text-black/66 transition hover:-translate-y-0.5 hover:border-[#2F61D8]/25 hover:text-[#2F61D8]"
                >
                  Portala qayıt
                </Link>
                <Link
                  href="/ismayilbank"
                  className="inline-flex items-center justify-center rounded-[1rem] bg-[#2F61D8] px-6 py-4 text-sm font-semibold tracking-[-0.03em] text-white shadow-[0_16px_36px_rgba(47,97,216,0.24)] transition hover:-translate-y-0.5 hover:bg-[#2854be]"
                >
                  Kalkulyatora keç
                </Link>
              </div>
            </MotionSection>
          </div>
        </section>
      </main>
    );
  }

  const greetingName = firstNameOf(account.name);
  const depositDetail = joinParts([
    account.annualRatePct != null
      ? `İllik artım faizi: ${formatPercentLabel(account.annualRatePct)}`
      : null,
    account.termMonths != null ? `müddət: ${account.termMonths} ay` : null,
    account.maturityBonusAzn != null
      ? `müddət sonunda əlavə məbləğ: ${formatAzn(account.maturityBonusAzn)}`
      : null,
  ]);
  const maturityLabel = formatDisplayDate(account.maturityDate);
  const depositFootnote = maturityLabel
    ? `Depozitin yetişmə tarixi: ${maturityLabel}`
    : "Depozit şərtləri sheet-ə əlavə olunduqca burada daha detallı görünəcək.";
  const nextPaymentLabel = formatDisplayDate(account.nextPaymentDate);
  const loanDetail = joinParts([
    account.monthlyPaymentAzn != null
      ? `Aylıq ödəniş: ${formatAzn(account.monthlyPaymentAzn)}`
      : null,
    nextPaymentLabel ? `növbəti tarix: ${nextPaymentLabel}` : null,
  ]);
  const loanFootnote =
    account.outstandingLoanAzn > 0
      ? "Qalıq kredit məbləği yuxarıda göstərilir. Tam cədvəl aşağıdakı blokda görünəcək."
      : "Hazırda aktiv cash loan görünmür.";

  return (
    <main className="min-h-screen px-2 py-2 sm:px-4 sm:py-4">
      <section className="mx-auto max-w-[1400px] overflow-hidden rounded-[2rem] border border-black/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.84),rgba(243,250,246,0.94)_50%,rgba(231,245,236,0.96))] shadow-[0_28px_90px_rgba(48,94,63,0.08)]">
        <BankHeader dateLabel={dateLabel} />

        <div className="relative px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(circle_at_12%_14%,rgba(255,255,255,0.74),rgba(255,255,255,0)_28%),radial-gradient(circle_at_78%_18%,rgba(216,244,223,0.44),rgba(216,244,223,0)_24%),radial-gradient(circle_at_88%_76%,rgba(225,241,255,0.3),rgba(225,241,255,0)_22%)]"
          />

          <div className="relative flex flex-col gap-8 lg:gap-10">
            <MotionSection className="grid gap-8 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)]">
              <div className="space-y-7">
                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-[0.34em] text-[#18A957]">
                    Xoş gəldin, {account.name.toLocaleUpperCase("az-AZ")}
                  </p>

                  <div className="flex items-start gap-4">
                    <AccentMark className="mt-2" />
                    <div>
                      <h1 className="text-[clamp(2.45rem,5vw,4.8rem)] font-black leading-[0.93] tracking-[-0.08em] text-[#2F61D8]">
                        {greetingName}, şəxsi hesabın hazırdır
                      </h1>
                      <p className="mt-3 max-w-3xl text-[1rem] leading-7 tracking-[-0.02em] text-black/54 sm:text-[1.08rem]">
                        Depozit və kredit məlumatların bu girişə bağlı şəkildə burada görünür.
                        İstəsəniz sheet-ə əlavə faiz və ödəniş sütunları qoşaraq bu səhifəni daha da
                        zənginləşdirə bilərik.
                      </p>
                    </div>
                  </div>
                </div>

                <StatementCard
                  title="Depozitə qoyduğunuz məbləğ"
                  amount={account.depositedAzn}
                  detail={depositDetail}
                  footnote={depositFootnote}
                />
              </div>

              <aside className="rounded-[2rem] border border-[#d7e7da] bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(246,251,248,0.92))] p-6 shadow-[0_22px_70px_rgba(61,104,72,0.08)] sm:p-7">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#2F61D8]">
                  Hesab icmalı
                </p>
                <h2 className="mt-3 text-[clamp(2rem,3vw,3rem)] font-black leading-[0.95] tracking-[-0.07em] text-[#151515]">
                  Bu gün üçün əsas baxış
                </h2>
                <p className="mt-4 text-[1rem] leading-7 tracking-[-0.02em] text-black/54">
                  Böyük məbləğləri önə çıxardım ki, səhifə bank çıxarışı kimi daha tez oxunsun.
                  Yardımçı detallar isə sağ blokda toplandı.
                </p>

                <div className="mt-6 grid gap-3">
                  <SummaryTile
                    label="Xalis mövqe"
                    tone={account.netAzn >= 0 ? "positive" : "negative"}
                    value={formatAzn(account.netAzn)}
                  />
                  <SummaryTile
                    label="Son yenilənmə"
                    value={formatDisplayDate(account.updatedAt) ?? dateLabel}
                  />
                  <SummaryTile
                    label="Kredit statusu"
                    tone={account.outstandingLoanAzn > 0 ? "negative" : "positive"}
                    value={account.outstandingLoanAzn > 0 ? "Aktiv kredit var" : "Aktiv kredit yoxdur"}
                  />
                </div>

                <div className="mt-6 rounded-[1.4rem] border border-dashed border-black/10 bg-white/68 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-black/42">
                    Təklif olunan yaxşılaşdırma
                  </p>
                  <p className="mt-2 text-sm leading-6 text-black/56">
                    Sheet-ə `annual_rate_pct`, `term_months`, `maturity_date`,
                    `monthly_payment_azn` və `payment_schedule` əlavə etsəniz, bu səhifə
                    eskizə daha da yaxınlaşacaq və boş hissələr qalmayacaq.
                  </p>
                </div>

                <div className="mt-6 flex flex-col gap-3">
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center justify-center rounded-[1rem] bg-[#2F61D8] px-5 py-3 text-sm font-semibold tracking-[-0.03em] text-white shadow-[0_16px_36px_rgba(47,97,216,0.24)] transition hover:-translate-y-0.5 hover:bg-[#2854be]"
                  >
                    Portfelimə keçid et
                  </Link>
                  <Link
                    href="/ismayilbank"
                    className="inline-flex items-center justify-center rounded-[1rem] border border-black/10 bg-white/84 px-5 py-3 text-sm font-semibold tracking-[-0.03em] text-black/66 transition hover:-translate-y-0.5 hover:border-[#2F61D8]/25 hover:text-[#2F61D8]"
                  >
                    Kalkulyatora qayıt
                  </Link>
                </div>
              </aside>
            </MotionSection>

            <MotionSection delay={0.06}>
              <StatementCard
                title="Borc götürdüyünüz məbləğ"
                amount={account.outstandingLoanAzn}
                detail={loanDetail}
                footnote={loanFootnote}
              />
            </MotionSection>

            <MotionSection delay={0.12}>
              <PaymentSchedule account={account} />
            </MotionSection>
          </div>
        </div>
      </section>
    </main>
  );
}
