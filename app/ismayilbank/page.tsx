import Link from "next/link";
import { IsmayilBankCalculator } from "@/components/IsmayilBankCalculator";
import { IsmayilBankDepositCalculator } from "@/components/IsmayilBankDepositCalculator";
import { IsmayilBankLogo } from "@/components/IsmayilBankLogo";
import { getSupabaseServerUser } from "@/lib/supabase/server";
import { getBankAccounts } from "@/lib/bank";

const fmt = new Intl.NumberFormat("az-AZ", { maximumFractionDigits: 0 });

function liquidityTileColor(pct: number): string {
  if (pct >= 60) return "text-[#128342]";
  if (pct >= 30) return "text-[#b45309]";
  return "text-[#c74252]";
}

export default async function IsmayilBankPage() {
  const [{ user }, accounts] = await Promise.all([
    getSupabaseServerUser(),
    getBankAccounts(),
  ]);

  const totalDeposits = accounts.reduce((s, a) => s + a.depositedAzn, 0);
  const totalLoans    = accounts.reduce((s, a) => s + a.outstandingLoanAzn, 0);
  const netLiquidity  = totalDeposits - totalLoans;
  const liquidityPct  = totalDeposits > 0 ? (netLiquidity / totalDeposits) * 100 : 0;
  const loanBarPct    = totalDeposits > 0 ? Math.min((totalLoans / totalDeposits) * 100, 100) : 0;

  const backHref = user ? "/bank" : "/welcome";
  const backLabel = user ? "Hesabıma qayıt" : "Geri qayıt";
  return (
    <main className="px-4 py-6 sm:px-6 sm:py-10">
      <section className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-[2.4rem] border border-blue-200/70 bg-white/72 p-6 shadow-[0_28px_80px_rgba(68,108,184,0.12)] backdrop-blur-xl sm:p-8 lg:p-12">
        <div
          aria-hidden
          className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-blue-300/30 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute left-[-4rem] top-[22%] h-44 w-44 rounded-full bg-sky-200/25 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-12 left-[12%] h-40 w-40 rounded-full bg-emerald-300/20 blur-3xl"
        />

        <div className="relative">
          <div className="flex justify-center">
            <div className="inline-flex rounded-[1.2rem] border border-blue-200/70 bg-white/82 px-5 py-3 shadow-[0_16px_38px_rgba(66,96,175,0.12)]">
              <IsmayilBankLogo size={54} />
            </div>
          </div>

          <h1 className="mt-8 text-center text-[clamp(3rem,8vw,5rem)] font-black tracking-[-0.08em] text-[#161616]">
            İsmayılBank hesablayıcısı
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-center text-[1.1rem] leading-8 tracking-[-0.02em] text-black/52 sm:text-[1.2rem]">
            Kredit və depozit məhsulları üçün ilkin hesablamanı burada edin.
            Şərtləri müqayisə edib sizə uyğun variantı rahat seçə bilərsiniz.
          </p>

          <div className="mt-12 space-y-12">
            {/* ── Liquidity Snapshot ── */}
            <section className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-black/38">
                Bank likvidliyi
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-black/6 bg-white/90 px-5 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/42">Ümumi depozit</p>
                  <p className="mt-2 text-[1.35rem] font-semibold tracking-[-0.03em] text-[#111111]">{fmt.format(totalDeposits)} ₼</p>
                </div>
                <div className="rounded-2xl border border-black/6 bg-white/90 px-5 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/42">Cəmi kredit</p>
                  <p className={`mt-2 text-[1.35rem] font-semibold tracking-[-0.03em] ${totalLoans > 0 ? "text-[#c74252]" : "text-[#111111]"}`}>{fmt.format(totalLoans)} ₼</p>
                </div>
                <div className="rounded-2xl border border-black/6 bg-white/90 px-5 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/42">Xalis likvidlik</p>
                  <p className="mt-2 text-[1.35rem] font-semibold tracking-[-0.03em] text-[#128342]">{fmt.format(netLiquidity)} ₼</p>
                </div>
                <div className="rounded-2xl border border-black/6 bg-white/90 px-5 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/42">Likvidlik nisbəti</p>
                  <p className={`mt-2 text-[1.35rem] font-semibold tracking-[-0.03em] ${totalDeposits > 0 ? liquidityTileColor(liquidityPct) : "text-[#111111]"}`}>{totalDeposits > 0 ? `${fmt.format(liquidityPct)}%` : "—"}</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="h-2 w-full overflow-hidden rounded-full bg-black/6">
                  <div
                    className="h-full rounded-l-full bg-[#c74252]/70 transition-all"
                    style={{ width: `${loanBarPct}%` }}
                  />
                </div>
                <div className="flex gap-4 text-[11px] font-medium text-black/42">
                  <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-[#c74252]/70" />Kredit</span>
                  <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-black/12" />Azad likvidlik</span>
                </div>
              </div>
            </section>

            <section className="space-y-5">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2F61D8]/76">
                  Kredit
                </p>
                <h2 className="mt-2 text-[clamp(2rem,4vw,3rem)] font-black tracking-[-0.07em] text-[#161616]">
                  Kredit kalkulyatoru
                </h2>
                <p className="mt-3 text-[1.02rem] leading-7 tracking-[-0.02em] text-black/52">
                  50-2000 AZN arasındakı məbləği və 1-12 ay müddəti seçin. İllik
                  faiz dərəcəsi seçdiyiniz müddətə uyğun tətbiq olunur.
                </p>
              </div>
              <IsmayilBankCalculator />
            </section>

            <section className="space-y-5">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#18A957]/76">
                  Depozit
                </p>
                <h2 className="mt-2 text-[clamp(2rem,4vw,3rem)] font-black tracking-[-0.07em] text-[#161616]">
                  Depozit kalkulyatoru
                </h2>
                <p className="mt-3 text-[1.02rem] leading-7 tracking-[-0.02em] text-black/52">
                  50-2000 AZN arasındakı depozit məbləğini seçin və 3, 6, 9 və ya
                  12 ay müddətlər üzrə müddət sonu qazancını görün.
                </p>
              </div>
              <IsmayilBankDepositCalculator />
            </section>
          </div>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link
              href={backHref}
              className="inline-flex items-center justify-center rounded-[1rem] border border-black/10 bg-white/80 px-6 py-4 text-base font-semibold tracking-[-0.03em] text-black/65 transition hover:-translate-y-0.5 hover:border-blue-300 hover:text-[#2F61D8]"
            >
              {backLabel}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
