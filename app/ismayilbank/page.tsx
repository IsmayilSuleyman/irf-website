import Link from "next/link";
import { IsmayilBankCalculator } from "@/components/IsmayilBankCalculator";
import { IsmayilBankDepositCalculator } from "@/components/IsmayilBankDepositCalculator";
import { IsmayilBankLogo } from "@/components/IsmayilBankLogo";
import { getSupabaseServerUser } from "@/lib/supabase/server";
import { getBankAccounts } from "@/lib/bank";
import { getBankProductTerms } from "@/lib/bankTerms";
import { getBondFundingAzn } from "@/lib/bonds";
import { formatGrouped } from "@/lib/portfolio";

function liquidityTone(pct: number): string {
  if (pct >= 60) return "text-status-paid dark:text-emerald-400";
  if (pct >= 30) return "text-status-warn dark:text-amber-400";
  return "text-status-late dark:text-rose-400";
}

// "3, 6, 9 və ya 12" — for the deposit copy, from the live tier list.
function joinMonths(months: number[]): string {
  if (months.length === 0) return "";
  if (months.length === 1) return String(months[0]);
  return `${months.slice(0, -1).join(", ")} və ya ${months[months.length - 1]}`;
}

// Section shell shared by every block on the page — same card language as
// /bank (CreditPanel & friends), so the calculator page reads as part of
// the bank app instead of a stand-alone landing splash.
function SectionCard({
  id,
  label,
  labelTone = "text-bank-blue/75 dark:text-blue-400/75",
  title,
  description,
  children,
}: {
  id?: string;
  label: string;
  labelTone?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-6 rounded-hero border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/10 p-6 sm:p-8"
    >
      <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${labelTone}`}>
        {label}
      </p>
      <h2 className="mt-1.5 text-xl font-semibold tracking-[-0.02em] text-ink dark:text-white/90 sm:text-2xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-2 max-w-2xl text-sm leading-6 text-black/55 dark:text-white/60">
          {description}
        </p>
      ) : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function StatTile({
  label,
  value,
  tone = "text-ink dark:text-white/90",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="min-w-[8.5rem] flex-1 basis-[calc(50%-0.75rem)] rounded-card border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/5 px-4 py-3.5 sm:basis-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/45 dark:text-white/50">
        {label}
      </p>
      <p className={`num mt-1.5 text-[1.25rem] font-semibold tracking-[-0.02em] tabular-nums ${tone}`}>
        {value}
      </p>
    </div>
  );
}

export default async function IsmayilBankPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [{ user }, accounts, terms, bondFunding, sp] = await Promise.all([
    getSupabaseServerUser(),
    getBankAccounts(),
    getBankProductTerms(),
    getBondFundingAzn(),
    searchParams,
  ]);

  // ?kredit=350 — the credit-offer banner's "Hesabla" link presets the
  // calculator near the offered amount (component clamps to slider range).
  const kreditRaw = Number(typeof sp?.kredit === "string" ? sp.kredit : NaN);
  const kreditPreset = Number.isFinite(kreditRaw) && kreditRaw > 0 ? kreditRaw : undefined;

  const totalDeposits = accounts.reduce((s, a) => s + a.depositedAzn, 0);
  const totalLoans    = accounts.reduce((s, a) => s + a.outstandingLoanAzn, 0);
  // Bond primary-sale proceeds are lendable funding alongside deposits.
  const totalFunding  = totalDeposits + bondFunding;
  const netLiquidity  = totalFunding - totalLoans;
  const liquidityPct  = totalFunding > 0 ? (netLiquidity / totalFunding) * 100 : 0;
  const loanBarPct    = totalFunding > 0 ? Math.min((totalLoans / totalFunding) * 100, 100) : 0;

  const creditMonths = [...terms.credit]
    .map((t) => t.termMonths)
    .sort((a, b) => a - b);
  const creditContiguous = creditMonths.every(
    (m, i) => i === 0 || m === creditMonths[i - 1] + 1,
  );
  // "1-12 ay" for a gapless list, "3, 6 və ya 12 ay" otherwise.
  const creditRangeLabel =
    creditContiguous && creditMonths.length > 1
      ? `${creditMonths[0]}-${creditMonths[creditMonths.length - 1]}`
      : joinMonths(creditMonths);
  const depositMonths = [...terms.deposit]
    .sort((a, b) => a.termMonths - b.termMonths)
    .map((t) => t.termMonths);
  const maxDepositRate = terms.deposit.reduce(
    (m, t) => Math.max(m, t.annualRatePct),
    0,
  );
  const minCreditRate = terms.credit.reduce(
    (m, t) => Math.min(m, t.annualRatePct),
    Infinity,
  );

  const backHref = user ? "/bank" : "/welcome";
  const backLabel = user ? "Hesabıma qayıt" : "Geri qayıt";

  const nav = [
    { href: "#kredit", label: "Kredit", desc: `illik ${formatGrouped(Number.isFinite(minCreditRate) ? minCreditRate : 0, 0)}%-dən` },
    { href: "#depozit", label: "Depozit", desc: `illik ${formatGrouped(maxDepositRate, 0)}%-dək` },
    { href: "/bonds", label: "İstiqraz", desc: "kupon gəliri" },
    { href: "#likvidlik", label: "Likvidlik", desc: "bankın vəziyyəti" },
  ];

  return (
    <main className="min-h-screen bg-bank-section">
      {/* Slim public-safe top bar: brand left, way back right — the page can
          be viewed signed-out, so it carries no auth-dependent controls. */}
      <header className="border-b border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-6 py-4 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
          <IsmayilBankLogo size={28} />
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 dark:border-white/15 bg-white/80 dark:bg-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-black/55 dark:text-white/60 transition hover:border-bank-blue/30 hover:text-bank-blue dark:hover:text-blue-400"
          >
            <span aria-hidden>←</span>
            {backLabel}
          </Link>
        </div>
      </header>

      <section className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-12">
        {/* Hero: left-aligned, app-scale type — the products speak through
            the cards below, not through a splash headline. */}
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-bank-blue dark:text-blue-400">
          İsmayılBank məhsulları
        </p>
        <h1 className="mt-2 text-[1.9rem] font-semibold leading-tight tracking-[-0.03em] text-ink dark:text-white/90 sm:text-[2.4rem]">
          Hesabla, müqayisə et, seç
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-7 text-black/55 dark:text-white/60">
          Kredit və depozit məhsulları üçün ilkin hesablamanı burada edin —
          şərtləri müqayisə edib sizə uyğun variantı seçin.
        </p>

        {/* Product quick-nav — same card row language as /bank's actions. */}
        <div className="mt-6 flex flex-wrap gap-3">
          {nav.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="group min-w-[8.5rem] flex-1 basis-[calc(50%-0.75rem)] rounded-card border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/10 px-4 py-3.5 transition hover:-translate-y-0.5 hover:border-bank-blue/30 hover:shadow-sm sm:basis-0"
            >
              <span className="block text-sm font-semibold tracking-[-0.02em] text-ink dark:text-white/90">
                {a.label}
              </span>
              <span className="mt-0.5 block text-[11px] text-black/45 dark:text-white/50">
                {a.desc}
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-8 space-y-8">
          <SectionCard
            id="kredit"
            label="Kredit"
            title="Kredit kalkulyatoru"
            description={`50–2000 ₼ arasındakı məbləği və ${creditRangeLabel} ay müddəti seçin — illik faiz dərəcəsi seçdiyiniz müddətə uyğun tətbiq olunur.`}
          >
            <IsmayilBankCalculator
              terms={terms.credit}
              initialAmountAzn={kreditPreset}
            />
          </SectionCard>

          <SectionCard
            id="depozit"
            label="Depozit"
            labelTone="text-brand-green/75 dark:text-emerald-400/75"
            title="Depozit kalkulyatoru"
            description={`50–2000 ₼ arasındakı depozit məbləğini seçin və ${joinMonths(depositMonths)} ay müddətlər üzrə müddət sonu qazancını görün.`}
          >
            <IsmayilBankDepositCalculator terms={terms.deposit} />
          </SectionCard>

          {/* Bonds teaser — one row, product identity + a single action. */}
          <section className="rounded-hero border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/10 p-6 sm:p-8">
            <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
              <div className="max-w-2xl">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-bank-blue/75 dark:text-blue-400/75">
                  İstiqraz
                </p>
                <h2 className="mt-1.5 text-xl font-semibold tracking-[-0.02em] text-ink dark:text-white/90 sm:text-2xl">
                  İstiqraz bazarı
                </h2>
                <p className="mt-2 text-sm leading-6 text-black/55 dark:text-white/60">
                  Bankın kupon istiqrazları: dövri faiz ödənişi, müddət sonunda
                  nominalın qaytarılması və iştirakçılar arasında alqı-satqı
                  imkanı.
                </p>
              </div>
              <Link
                href="/bonds"
                className="inline-flex shrink-0 items-center justify-center rounded-xl bg-bank-blue px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-bank-blue-deep"
              >
                Buraxılışlara bax
              </Link>
            </div>
          </section>

          {/* Liquidity — the bank's own balance sheet, in one card with the
              funding bar under the tiles so the numbers and the picture sit
              together. */}
          <SectionCard
            id="likvidlik"
            label="Şəffaflıq"
            labelTone="text-black/45 dark:text-white/50"
            title="Bank likvidliyi"
            description="Cəlb olunan vəsait (depozitlər və istiqraz satışı) ilə verilmiş kreditlərin canlı balansı."
          >
            <div className="flex flex-wrap gap-3">
              <StatTile
                label="Ümumi depozit"
                value={`${formatGrouped(totalDeposits, 0)} ₼`}
              />
              {bondFunding > 0 ? (
                <StatTile
                  label="İstiqraz vəsaiti"
                  value={`${formatGrouped(bondFunding, 0)} ₼`}
                  tone="text-bank-blue dark:text-blue-400"
                />
              ) : null}
              <StatTile
                label="Cəmi kredit"
                value={`${formatGrouped(totalLoans, 0)} ₼`}
                tone={
                  totalLoans > 0
                    ? "text-status-late dark:text-rose-400"
                    : "text-ink dark:text-white/90"
                }
              />
              <StatTile
                label="Xalis likvidlik"
                value={`${formatGrouped(netLiquidity, 0)} ₼`}
                tone="text-brand-green-deep dark:text-emerald-400"
              />
              <StatTile
                label="Likvidlik nisbəti"
                value={totalFunding > 0 ? `${formatGrouped(liquidityPct, 0)}%` : "—"}
                tone={
                  totalFunding > 0
                    ? liquidityTone(liquidityPct)
                    : "text-ink dark:text-white/90"
                }
              />
            </div>
            <div className="mt-5 space-y-2">
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-brand-green/25 dark:bg-emerald-500/25">
                <div
                  className="h-full rounded-r-full bg-status-late/80 transition-all"
                  style={{ width: `${loanBarPct}%` }}
                />
              </div>
              <div className="flex gap-4 text-[11px] font-medium text-black/45 dark:text-white/50">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-status-late/80" />
                  Kredit
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-brand-green/40 dark:bg-emerald-500/40" />
                  Azad likvidlik
                </span>
              </div>
            </div>
          </SectionCard>
        </div>
      </section>
    </main>
  );
}
