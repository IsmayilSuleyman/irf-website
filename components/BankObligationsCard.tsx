import { formatAzn } from "@/lib/portfolio";
import type { BankWideAggregate } from "@/lib/bank";
import type { BondObligations } from "@/lib/liquidityProjection";

// The honest solvency statement in one card: EVERY standing promise the
// bank has made — deposits on demand, interest when due, coupons on
// schedule, nominal at maturity — summed to a single Cəmi öhdəlik. The
// green footer is the counterweight: what has already been paid out, the
// bank's track record in one line.

function Row({
  label,
  hint,
  amountAzn,
}: {
  label: string;
  hint?: string;
  amountAzn: number;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-5 py-2.5 sm:px-6">
      <div className="min-w-0">
        <p className="text-sm text-ink dark:text-white/90">{label}</p>
        {hint ? (
          <p className="mt-0.5 text-[11px] text-black/45 dark:text-white/50">{hint}</p>
        ) : null}
      </div>
      <p className="num shrink-0 text-sm font-semibold tabular-nums text-ink dark:text-white/90">
        {formatAzn(amountAzn)}
      </p>
    </div>
  );
}

export function BankObligationsCard({
  aggregate,
  bondObligations,
  unsettledAvailable,
}: {
  aggregate: BankWideAggregate;
  bondObligations: BondObligations;
  unsettledAvailable: boolean;
}) {
  const a = aggregate;
  const totalAzn =
    a.totalDepositsAzn +
    a.totalPendingBonusAzn +
    a.unsettledInterestAzn +
    a.unsettledRewardsAzn +
    bondObligations.totalAzn;
  const settledAzn = a.settledInterestAzn + a.settledRewardsAzn;

  return (
    <section
      id="ohdelikler"
      className="scroll-mt-6 rounded-hero border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/10"
    >
      <header className="px-5 py-4 sm:px-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/50">
          Öhdəliklər
        </p>
        <h2 className="mt-1 text-[15px] font-semibold tracking-[-0.02em] text-ink dark:text-white/90">
          Bankın bütün vədləri
        </h2>
      </header>
      <div className="divide-y divide-black/5 dark:divide-white/5 border-t border-black/10 dark:border-white/10">
        <Row
          label="Depozit əsas məbləğləri"
          hint="tələb olunanda qaytarılır"
          amountAzn={a.totalDepositsAzn}
        />
        {a.totalPendingBonusAzn > 0 ? (
          <Row
            label="Müddətli depozit faizləri"
            hint="müddət sonunda ödənilir"
            amountAzn={a.totalPendingBonusAzn}
          />
        ) : null}
        {unsettledAvailable && a.unsettledInterestAzn > 0 ? (
          <Row
            label="Hesablaşılmamış günlük faiz"
            hint="hər gün hesablanır, Sheet depozitinə köçürülənədək burada"
            amountAzn={a.unsettledInterestAzn}
          />
        ) : null}
        {unsettledAvailable && a.unsettledRewardsAzn > 0 ? (
          <Row
            label="Hesablaşılmamış mükafatlar"
            hint="günlük mükafat qazancları"
            amountAzn={a.unsettledRewardsAzn}
          />
        ) : null}
        {bondObligations.couponsRemainingAzn > 0 ? (
          <Row
            label="İstiqraz kuponları (qalan)"
            hint="cədvəl üzrə gələcək kupon ödənişləri"
            amountAzn={bondObligations.couponsRemainingAzn}
          />
        ) : null}
        {bondObligations.nominalAzn > 0 ? (
          <Row
            label="İstiqraz nominalı"
            hint="müddət sonunda qaytarılır"
            amountAzn={bondObligations.nominalAzn}
          />
        ) : null}
        <div className="flex items-baseline justify-between gap-4 px-5 py-3.5 sm:px-6">
          <p className="text-sm font-semibold text-ink dark:text-white/90">Cəmi öhdəlik</p>
          <p className="num shrink-0 text-[15px] font-bold tabular-nums text-ink dark:text-white/90">
            {formatAzn(totalAzn)}
          </p>
        </div>
      </div>
      {settledAzn > 0 ? (
        <div className="border-t border-black/10 dark:border-white/10 bg-brand-green-mist/60 dark:bg-brand-green/10 px-5 py-3 sm:px-6">
          <p className="text-[12px] font-medium text-brand-green-deep dark:text-emerald-400">
            Bu günə ödənilib: günlük faiz {formatAzn(a.settledInterestAzn)} ·
            mükafatlar {formatAzn(a.settledRewardsAzn)}
          </p>
          <p className="mt-0.5 text-[11px] text-black/45 dark:text-white/50">
            artıq depozitorların balansına köçürülmüş qazanclar
          </p>
        </div>
      ) : null}
      {!unsettledAvailable ? (
        <p className="border-t border-black/10 dark:border-white/10 px-5 py-3 text-[11px] text-black/45 dark:text-white/50 sm:px-6">
          Günlük faiz və mükafat qeydləri hazırda əlçatan deyil — siyahı
          yalnız cədvəldəki öhdəlikləri göstərir.
        </p>
      ) : null}
    </section>
  );
}
