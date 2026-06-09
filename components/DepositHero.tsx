// Personal /bank deposit "hero": one big number for the deposit principal,
// mirroring FundHero on /dashboard?view=fund. Supporting line below carries
// term · annual rate · maturity end amount (green) · maturity date.
//
// The page-level "Qeyd: depozit üzrə faiz yalnız müddətin sonunda ödənilir…"
// note stays on the page; this component only owns the headline + breakdown.
import { Odometer } from "@/components/Odometer";
import { formatGrouped, formatGroupedTrim } from "@/lib/portfolio";
import { formatBakuDate } from "@/lib/user";

function formatDisplayDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? value : formatBakuDate(parsed);
}

// Number-only money: integer when whole, 2 decimals otherwise. Caller appends
// the ₼ suffix (matches the rest of /bank).
function formatAmount(value: number): string {
  const hasFraction = Math.abs(value % 1) > 0.001;
  return formatGrouped(value, hasFraction ? 2 : 0);
}

function formatPercent(value: number | null): string {
  if (value == null) return "—";
  return `${formatGroupedTrim(value, 2)}%`;
}

export function DepositHero({
  depositedAzn,
  termMonths,
  annualRatePct,
  maturityBonusAzn,
  maturityDate,
}: {
  depositedAzn: number;
  termMonths: number | null;
  annualRatePct: number | null;
  maturityBonusAzn: number | null;
  maturityDate: string | null;
}) {
  const maturityEndAmount =
    maturityBonusAzn != null ? depositedAzn + maturityBonusAzn : null;
  const maturityDateLabel = formatDisplayDate(maturityDate);

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-bank-blue">
        Depozit balansım
      </p>

      <div
        className="num mt-2 font-black leading-none tracking-tight text-ink"
        style={{ fontSize: "clamp(3.25rem, 10vw, 6.5rem)" }}
      >
        <Odometer value={depositedAzn} fractionDigits={2} suffix="₼" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-black/55">
        {termMonths != null ? (
          <span>
            müddət{" "}
            <span className="font-medium text-black/70">{termMonths} ay</span>
          </span>
        ) : null}
        {annualRatePct != null ? (
          <span>
            · illik{" "}
            <span className="font-medium text-black/70">
              {formatPercent(annualRatePct)}
            </span>
          </span>
        ) : null}
        {maturityEndAmount != null ? (
          <span>
            müddət sonu{" "}
            <span className="font-medium text-brand-green-deep">
              {formatAmount(maturityEndAmount)}₼
            </span>
            {maturityDateLabel ? (
              <span className="text-black/45"> ({maturityDateLabel})</span>
            ) : null}
          </span>
        ) : null}
      </div>
    </div>
  );
}
