import Link from "next/link";
import { Odometer } from "@/components/Odometer";
import { formatAzn, formatGrouped, formatUnits } from "@/lib/portfolio";
import type { FounderView } from "@/lib/bankFounder";

// İsmayıl's /bank hero in Təsisçi rejimi — the BalanceHero's card language
// (label, big odometer, composition bar, legs with meta lines), but the
// story is the OWNER's, not a depositor's: the bank's net position first,
// then what he put in, what outsiders put in, where it sits, and the
// monthly run-rate of interest earned against interest promised. No daily
// interest accrues to the founder here — the bank does not pay itself.

function formatAmount(value: number): string {
  const hasFraction = Math.abs(value % 1) > 0.001;
  return formatGrouped(value, hasFraction ? 2 : 0);
}

const signed = (n: number) => `${n < 0 ? "−" : "+"}${formatAzn(Math.abs(n))}`;

function Leg({
  dotClass,
  label,
  amountAzn,
  meta,
}: {
  dotClass: string;
  label: string;
  amountAzn: number;
  meta?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span aria-hidden className={`h-2 w-2 rounded-full ${dotClass}`} />
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/50">
          {label}
        </p>
      </div>
      <p className="num mt-2 text-[1.4rem] font-semibold leading-none tracking-[-0.02em] tabular-nums text-ink dark:text-white/90">
        {formatAmount(amountAzn)}
        <span className="ml-0.5 text-[0.95rem] font-medium text-black/40 dark:text-white/45">₼</span>
      </p>
      {meta ? (
        <p className="mt-1.5 text-[11px] leading-5 text-black/45 dark:text-white/50">{meta}</p>
      ) : null}
    </div>
  );
}

export function FounderHero({ founder }: { founder: FounderView }) {
  const f = founder;
  const sourcesTotal = f.capitalAzn + f.outsiderFundingAzn;
  const capitalPct = sourcesTotal > 0 ? (f.capitalAzn / sourcesTotal) * 100 : 100;
  const marginUp = f.monthlyMarginAzn >= 0;

  return (
    <section className="rounded-hero border border-black/10 bg-white/90 p-6 dark:border-white/10 dark:bg-white/10 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/50">
          Təsisçi mövqeyi · bankın xalis dəyəri
        </p>
        <span
          className={`num inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums ${
            marginUp
              ? "bg-brand-green-mist text-status-paid dark:bg-brand-green/15 dark:text-emerald-400"
              : "bg-status-late-soft text-status-late dark:bg-status-late/20 dark:text-rose-400"
          }`}
        >
          marja {signed(f.monthlyMarginAzn)}/ay
        </span>
      </div>

      <div
        className={`num mt-3 font-semibold leading-none tracking-[-0.03em] ${
          f.equityAzn >= 0 ? "text-ink dark:text-white/90" : "text-status-late dark:text-rose-400"
        }`}
        style={{ fontSize: "clamp(2.6rem, 7vw, 3.6rem)" }}
      >
        <Odometer value={f.equityAzn} fractionDigits={2} suffix="₼" />
      </div>
      <p className="mt-2 text-xs text-black/45 dark:text-white/50">
        kapital {formatAzn(f.capitalAzn)} − kənar iştirakçılara vəd edilmiş faiz{" "}
        {formatAzn(f.promisedInterestAzn + f.bondDiscountAzn)}
        {f.loanInterestAheadAzn > 0 ? (
          <>
            {" "}· kredit faizi gələndən sonra{" "}
            <span className="num font-semibold text-brand-green-deep dark:text-emerald-400">
              {formatAzn(f.equityAfterIncomeAzn)}
            </span>
          </>
        ) : null}
      </p>

      {/* Funding composition: founder capital vs outsiders' money. */}
      <div className="mt-5 flex h-2 w-full gap-0.5 overflow-hidden rounded-full" aria-hidden>
        <span className="h-full rounded-l-full bg-bank-blue-deep dark:bg-blue-400" style={{ width: `${capitalPct}%` }} />
        <span className="h-full flex-1 rounded-r-full bg-bank-blue/40" />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-6 border-t border-black/10 pt-5 dark:border-white/10 sm:grid-cols-4 sm:gap-8">
        <Leg
          dotClass="bg-bank-blue-deep dark:bg-blue-400"
          label="Kapitalım"
          amountAzn={f.capitalAzn}
          meta={
            <>
              depozit sətri {formatAzn(f.founderDepositAzn)}
              {f.founderBondUnits > 0 ? (
                <>
                  {" "}· öz istiqrazlarım{" "}
                  <span className="num">{formatUnits(f.founderBondUnits)}</span> ədəd (
                  {formatAzn(f.founderBondProceedsAzn)})
                </>
              ) : null}
            </>
          }
        />
        <Leg
          dotClass="bg-bank-blue/40"
          label="Kənar vəsait"
          amountAzn={f.outsiderFundingAzn}
          meta={
            <>
              depozitlər {formatAzn(f.outsiderDepositsAzn)} · istiqraz{" "}
              {formatAzn(f.outsiderBondFundingAzn)}
            </>
          }
        />
        <Leg
          dotClass="bg-status-late/70"
          label="Kreditlərdə"
          amountAzn={f.loansAzn}
          meta={
            f.loanInterestAheadAzn > 0 ? (
              <>
                cədvəl üzrə gələcək faiz{" "}
                <span className="num font-semibold text-brand-green-deep dark:text-emerald-400">
                  +{formatAzn(f.loanInterestAheadAzn)}
                </span>
              </>
            ) : (
              <>cədvəllərdə faiz gəliri görünmür</>
            )
          }
        />
        <Leg
          dotClass="bg-brand-green"
          label="Azad pul"
          amountAzn={f.freeLiquidityAzn}
          meta={<>kapital daxil, kreditlər çıxılmaqla · ehtiyat {formatAzn(f.assetReserveAzn)} ayrıca</>}
        />
      </div>

      {/* The run-rate: what the book earns against what it promises. */}
      <div className="mt-5 grid grid-cols-1 gap-4 border-t border-black/10 pt-5 dark:border-white/10 sm:grid-cols-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/45 dark:text-white/50">
            Aylıq gəlir
          </p>
          <p className="num mt-1 text-[15px] font-semibold tabular-nums text-brand-green-deep dark:text-emerald-400">
            +{formatAzn(f.monthlyIncomeAzn)}
          </p>
          <p className="mt-0.5 text-[11px] text-black/45 dark:text-white/50">
            kredit cədvəllərində qalan faizin aylıq ortası
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/45 dark:text-white/50">
            Aylıq xərc
          </p>
          <p className="num mt-1 text-[15px] font-semibold tabular-nums text-status-late dark:text-rose-400">
            −{formatAzn(f.monthlyExpenseAzn)}
          </p>
          <p className="mt-0.5 text-[11px] text-black/45 dark:text-white/50">
            günlük faiz {formatAzn(f.monthlyDailyDepositInterestAzn)} · müddətli{" "}
            {formatAzn(f.monthlyTermInterestAzn)} · kupon {formatAzn(f.monthlyCouponAzn)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/45 dark:text-white/50">
            Vəd edilmiş faiz (bu gün)
          </p>
          <p className="num mt-1 text-[15px] font-semibold tabular-nums text-ink dark:text-white/90">
            {formatAzn(f.promisedInterestAzn)}
          </p>
          <p className="mt-0.5 text-[11px] text-black/45 dark:text-white/50">
            bonus {formatAzn(f.pendingBonusAzn)} · hesablaşılmamış{" "}
            {formatAzn(f.unsettledLedgerAzn)} · kupon {formatAzn(f.couponsRemainingAzn)}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-black/10 pt-4 dark:border-white/10">
        <p className="max-w-[60ch] text-[11px] leading-5 text-black/45 dark:text-white/50">
          Təsisçi rejimində öz depozitinə günlük faiz hesablanmır və öz
          istiqrazlarının kuponu xərc sayılmır
          {f.ownMonthlyCouponAzn > 0 ? ` (daxili ${formatAzn(f.ownMonthlyCouponAzn)}/ay)` : ""}
          {f.ownUnsettledAzn > 0
            ? `. Əvvəldən hesablanmış ${formatAzn(f.ownUnsettledAzn)} öhdəlikdən çıxarılıb.`
            : "."}
        </p>
        <Link
          href="/bank?view=bank#pul-axini"
          className="inline-flex items-center gap-1.5 rounded-xl bg-bank-blue px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-bank-blue-deep"
        >
          Pul axınına bax
        </Link>
      </div>
    </section>
  );
}
