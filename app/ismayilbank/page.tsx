import Link from "next/link";
import { IsmayilBankCalculator } from "@/components/IsmayilBankCalculator";
import { IsmayilBankDepositCalculator } from "@/components/IsmayilBankDepositCalculator";
import { IsmayilBankLogo } from "@/components/IsmayilBankLogo";
import { getSupabaseServerUser } from "@/lib/supabase/server";
import { getBankAccounts } from "@/lib/bank";
import { getBankProductTerms } from "@/lib/bankTerms";
import { getBondFundingAzn } from "@/lib/bonds";
import { formatGrouped } from "@/lib/portfolio";

function liquidityTileColor(pct: number): string {
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

export default async function IsmayilBankPage() {
  const [{ user }, accounts, terms, bondFunding] = await Promise.all([
    getSupabaseServerUser(),
    getBankAccounts(),
    getBankProductTerms(),
    getBondFundingAzn(),
  ]);

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

  const backHref = user ? "/bank" : "/welcome";
  const backLabel = user ? "Hesabıma qayıt" : "Geri qayıt";
  return (
    <main className="min-h-screen bg-bank-section px-4 py-6 sm:px-6 sm:py-10">
      <section className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-hero border border-blue-200/70 dark:border-blue-400/25 bg-white/70 dark:bg-white/10 p-6 shadow-[0_28px_80px_rgba(68,108,184,0.12)] backdrop-blur-xl sm:p-8 lg:p-12">
        <div
          aria-hidden
          className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-blue-300/30 dark:bg-blue-500/10 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute left-[-4rem] top-[22%] h-44 w-44 rounded-full bg-sky-200/25 dark:bg-sky-500/10 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-12 left-[12%] h-40 w-40 rounded-full bg-emerald-300/20 dark:bg-emerald-500/10 blur-3xl"
        />

        <div className="relative">
          <div className="flex justify-center">
            <div className="inline-flex rounded-card border border-blue-200/70 dark:border-blue-400/25 bg-white/80 dark:bg-white/10 px-5 py-3 shadow-[0_16px_38px_rgba(66,96,175,0.12)]">
              <IsmayilBankLogo size={54} />
            </div>
          </div>

          <h1 className="mt-8 text-center text-[clamp(3rem,8vw,5rem)] font-black tracking-[-0.08em] text-ink dark:text-white/90">
            İsmayılBank hesablayıcısı
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-center text-[1.1rem] leading-8 tracking-[-0.02em] text-black/55 dark:text-white/60 sm:text-[1.2rem]">
            Kredit və depozit məhsulları üçün ilkin hesablamanı burada edin.
            Şərtləri müqayisə edib sizə uyğun variantı rahat seçə bilərsiniz.
          </p>

          <div className="mt-12 space-y-12">
            <section className="space-y-5">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-bank-blue/75 dark:text-blue-400/75">
                  Kredit
                </p>
                <h2 className="mt-2 text-[clamp(2rem,4vw,3rem)] font-black tracking-[-0.07em] text-ink dark:text-white/90">
                  Kredit kalkulyatoru
                </h2>
                <p className="mt-3 text-[1.02rem] leading-7 tracking-[-0.02em] text-black/55 dark:text-white/60">
                  50-2000 AZN arasındakı məbləği və {creditRangeLabel} ay müddəti seçin. İllik
                  faiz dərəcəsi seçdiyiniz müddətə uyğun tətbiq olunur.
                </p>
              </div>
              <IsmayilBankCalculator terms={terms.credit} />
            </section>

            <section className="space-y-5">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-green/75 dark:text-emerald-400/75">
                  Depozit
                </p>
                <h2 className="mt-2 text-[clamp(2rem,4vw,3rem)] font-black tracking-[-0.07em] text-ink dark:text-white/90">
                  Depozit kalkulyatoru
                </h2>
                <p className="mt-3 text-[1.02rem] leading-7 tracking-[-0.02em] text-black/55 dark:text-white/60">
                  50-2000 AZN arasındakı depozit məbləğini seçin və {joinMonths(depositMonths)} ay
                  müddətlər üzrə müddət sonu qazancını görün.
                </p>
              </div>
              <IsmayilBankDepositCalculator terms={terms.deposit} />
            </section>

            {/* ── Bonds teaser ── */}
            <section className="rounded-hero border border-blue-200/70 dark:border-blue-400/25 bg-white/80 dark:bg-white/10 p-6 sm:p-8">
              <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div className="max-w-2xl">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-bank-blue/75 dark:text-blue-400/75">
                    İstiqraz
                  </p>
                  <h2 className="mt-2 text-[clamp(1.6rem,3vw,2.2rem)] font-black tracking-[-0.06em] text-ink dark:text-white/90">
                    İstiqraz bazarı
                  </h2>
                  <p className="mt-3 text-[1.02rem] leading-7 tracking-[-0.02em] text-black/55 dark:text-white/60">
                    Bankın kupon istiqrazları: dövri faiz ödənişi, müddət sonunda nominalın
                    qaytarılması və iştirakçılar arasında alqı-satqı imkanı.
                  </p>
                </div>
                <Link
                  href="/bonds"
                  className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-bank-blue px-6 py-4 text-base font-semibold tracking-[-0.03em] text-white transition hover:-translate-y-0.5 hover:bg-bank-blue-deep"
                >
                  Buraxılışlara bax
                </Link>
              </div>
            </section>

            {/* ── Liquidity Snapshot ── */}
            <section className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/50">
                Bank likvidliyi
              </p>
              {/* flex-wrap so the row balances with or without the bond tile */}
              <div className="flex flex-wrap gap-3">
                <div className="min-w-[9rem] flex-1 basis-[calc(50%-0.75rem)] rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/10 px-5 py-4 sm:basis-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/50">Ümumi depozit</p>
                  <p className="mt-2 text-[1.35rem] font-semibold tracking-[-0.03em] text-ink dark:text-white/90">{formatGrouped(totalDeposits, 0)} ₼</p>
                </div>
                {bondFunding > 0 ? (
                  <div className="min-w-[9rem] flex-1 basis-[calc(50%-0.75rem)] rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/10 px-5 py-4 sm:basis-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/50">İstiqraz vəsaiti</p>
                    <p className="mt-2 text-[1.35rem] font-semibold tracking-[-0.03em] text-bank-blue dark:text-blue-400">{formatGrouped(bondFunding, 0)} ₼</p>
                  </div>
                ) : null}
                <div className="min-w-[9rem] flex-1 basis-[calc(50%-0.75rem)] rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/10 px-5 py-4 sm:basis-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/50">Cəmi kredit</p>
                  <p className={`mt-2 text-[1.35rem] font-semibold tracking-[-0.03em] ${totalLoans > 0 ? "text-status-late dark:text-rose-400" : "text-ink dark:text-white/90"}`}>{formatGrouped(totalLoans, 0)} ₼</p>
                </div>
                <div className="min-w-[9rem] flex-1 basis-[calc(50%-0.75rem)] rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/10 px-5 py-4 sm:basis-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/50">Xalis likvidlik</p>
                  <p className="mt-2 text-[1.35rem] font-semibold tracking-[-0.03em] text-brand-green-deep dark:text-emerald-400">{formatGrouped(netLiquidity, 0)} ₼</p>
                </div>
                <div className="min-w-[9rem] flex-1 basis-[calc(50%-0.75rem)] rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/10 px-5 py-4 sm:basis-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/50">Likvidlik nisbəti</p>
                  <p className={`mt-2 text-[1.35rem] font-semibold tracking-[-0.03em] ${totalFunding > 0 ? liquidityTileColor(liquidityPct) : "text-ink dark:text-white/90"}`}>{totalFunding > 0 ? `${formatGrouped(liquidityPct, 0)}%` : "—"}</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="h-2 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                  <div
                    className="h-full rounded-l-full bg-status-late/70 transition-all"
                    style={{ width: `${loanBarPct}%` }}
                  />
                </div>
                <div className="flex gap-4 text-[11px] font-medium text-black/45 dark:text-white/50">
                  <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-status-late/70" />Kredit</span>
                  <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-black/10 dark:bg-white/15" />Azad likvidlik</span>
                </div>
              </div>
            </section>
          </div>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link
              href={backHref}
              className="inline-flex items-center justify-center rounded-2xl border border-black/10 dark:border-white/15 bg-white/80 dark:bg-white/10 px-6 py-4 text-base font-semibold tracking-[-0.03em] text-black/70 dark:text-white/75 transition hover:-translate-y-0.5 hover:border-blue-300 dark:border-blue-400/40 hover:text-bank-blue dark:hover:text-blue-400"
            >
              {backLabel}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
