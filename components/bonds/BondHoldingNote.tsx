import { couponAmountAzn, type BondSeries } from "@/lib/bonds";
import { formatGrouped, formatUnits } from "@/lib/portfolio";

/**
 * What this holder earns from an issue, in plain Azerbaijani, under the
 * series card.
 *
 * Only an active series earns: a matured or cancelled one says nothing here
 * and lets its status pill speak, so the card never promises a payment that
 * will not arrive.
 *
 * The per-bond figure is hedged with "təxminən" on purpose. Coupons are paid
 * on the whole holding and rounded once (see couponAmountAzn), so at 20% on a
 * 25 ₼ monthly bond each unit is really 0,4167 ₼ and five pay 2,08 ₼ — not
 * 5 × 0,42 = 2,10. The total shown is always the amount actually paid.
 */
export function BondHoldingNote({ series }: { series: BondSeries }) {
  const units = series.my_units;
  const base = "mt-1 text-[11px] leading-relaxed text-black/45 dark:text-white/50";
  const strong = "num font-semibold text-ink dark:text-white/90";

  if (units <= 0) {
    return (
      <p className={base}>
        Bu istiqraz buraxılışından heç bir istiqraza sahib deyilsiniz.
      </p>
    );
  }
  if (series.status !== "active") return null;

  const every = `${series.coupon_period_months} aydan bir`;
  const perUnit = couponAmountAzn(series, 1);
  const total = couponAmountAzn(series, units);

  // One bond needs no total — the per-bond amount already is the total, and
  // it is exact rather than an approximation.
  if (units === 1) {
    return (
      <p className={base}>
        Sahib olduğunuz 1 istiqraz hər ödənişdə ({every}) sizə{" "}
        <span className={strong}>{formatGrouped(perUnit, 2)} ₼</span> qazandırır.
      </p>
    );
  }

  return (
    <p className={base}>
      Bu buraxılışdan sahib olduğunuz hər istiqraz hər ödənişdə ({every}) sizə
      təxminən <span className={strong}>{formatGrouped(perUnit, 2)} ₼</span>,
      sahib olduğunuz <span className={strong}>{formatUnits(units)}</span>{" "}
      istiqraz isə birlikdə{" "}
      <span className={strong}>{formatGrouped(total, 2)} ₼</span> qazandırır.
    </p>
  );
}
