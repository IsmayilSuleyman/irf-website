// Personal /bank balance "hero": one big number for everything İsmayılBank
// owes the holder — deposit principal + bonds at nominal — mirroring FundHero
// on /dashboard?view=fund. The two legs underneath break that total back down
// so the headline is always traceable to its parts, and each leg carries the
// small print for its own product rather than pushing it below the fold.
//
// With no bonds the hero is exactly the old deposit hero: same label, same
// supporting line, no legs — a total that just repeats the deposit would be
// noise for holders who only have a deposit. The deposit note then sits under
// the hero as before, so the copy has a single owner either way.
import { Odometer } from "@/components/Odometer";
import { formatGrouped, formatGroupedTrim, formatUnits } from "@/lib/portfolio";
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

function Leg({
  label,
  amountAzn,
  detail,
  earning,
  note,
  tone,
}: {
  label: string;
  amountAzn: number;
  detail?: React.ReactNode;
  earning: React.ReactNode;
  note: React.ReactNode;
  tone: "ink" | "blue";
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/10 px-5 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/50">
        {label}
      </p>
      <p
        className={`num mt-2 text-[1.35rem] font-semibold tracking-[-0.03em] ${
          tone === "blue"
            ? "text-bank-blue dark:text-blue-400"
            : "text-ink dark:text-white/90"
        }`}
      >
        {formatAmount(amountAzn)}₼
      </p>
      {detail ? (
        <p className="mt-1 text-[11px] leading-4 text-black/45 dark:text-white/50">{detail}</p>
      ) : null}
      {earning ? (
        <p className="mt-1 text-[11px] leading-4 text-black/45 dark:text-white/50">{earning}</p>
      ) : null}
      <p className="mt-3 border-t border-black/5 dark:border-white/10 pt-3 text-[11px] leading-[1.45] text-black/45 dark:text-white/50">
        {note}
      </p>
    </div>
  );
}

export function BalanceHero({
  depositedAzn,
  termMonths,
  annualRatePct,
  maturityBonusAzn,
  maturityDate,
  depositMonthlyAzn,
  bondValueAzn,
  bondUnits,
  bondIssues,
  bondMonthlyAzn,
}: {
  depositedAzn: number;
  termMonths: number | null;
  annualRatePct: number | null;
  maturityBonusAzn: number | null;
  maturityDate: string | null;
  /** Interest the deposit accrues per month (paid at maturity, not monthly). */
  depositMonthlyAzn: number;
  /** Bonds at nominal — units × face value, active series only. */
  bondValueAzn: number;
  bondUnits: number;
  bondIssues: number;
  /** Average coupon income per month across the held series. */
  bondMonthlyAzn: number;
}) {
  const hasBonds = bondUnits > 0;
  const hasDeposit = depositedAzn > 0;
  const totalAzn = depositedAzn + bondValueAzn;
  const maturityEndAmount =
    maturityBonusAzn != null ? depositedAzn + maturityBonusAzn : null;
  const maturityDateLabel = formatDisplayDate(maturityDate);

  const depositNote = (
    <>
      Qeyd: depozit üzrə hesablanmış faiz yalnız depozit müddətinin sonunda
      {maturityDateLabel ? ` (${maturityDateLabel})` : ""} ödənilir. Vaxtından əvvəl
      çıxarılan depozitlərə faiz gəliri verilmir.
    </>
  );

  const depositDetail = (
    <>
      {termMonths != null ? <>müddət {termMonths} ay</> : null}
      {termMonths != null && annualRatePct != null ? " · " : null}
      {annualRatePct != null ? <>illik {formatPercent(annualRatePct)}</> : null}
      {maturityEndAmount != null ? (
        <>
          {termMonths != null || annualRatePct != null ? " · " : null}
          müddət sonu{" "}
          <span className="num font-semibold text-brand-green-deep dark:text-emerald-400">
            {formatAmount(maturityEndAmount)}₼
          </span>
          {maturityDateLabel ? <> ({maturityDateLabel})</> : null}
        </>
      ) : null}
    </>
  );

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-bank-blue dark:text-blue-400">
        {hasBonds ? "Ümumi balansım" : "Depozit balansım"}
      </p>

      <div
        className="num mt-2 font-black leading-none tracking-tight text-ink dark:text-white/90"
        style={{ fontSize: "clamp(3.25rem, 10vw, 6.5rem)" }}
      >
        <Odometer value={totalAzn} fractionDigits={2} suffix="₼" />
      </div>

      {hasBonds ? (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {hasDeposit ? (
            <Leg
              label="Depozit"
              amountAzn={depositedAzn}
              detail={depositDetail}
              earning={
                depositMonthlyAzn > 0 ? (
                  <>
                    Bu depozit sizə ayda{" "}
                    <span className="num font-semibold text-ink dark:text-white/90">
                      {formatGrouped(depositMonthlyAzn, 2)} ₼
                    </span>{" "}
                    qazandırır.
                  </>
                ) : null
              }
              note={depositNote}
              tone="ink"
            />
          ) : null}
          <Leg
            label="İstiqraz"
            amountAzn={bondValueAzn}
            detail={
              <>
                <span className="num">{formatUnits(bondUnits)}</span> istiqraz ·{" "}
                <span className="num">{bondIssues}</span> buraxılış · nominal dəyər
              </>
            }
            earning={
              bondMonthlyAzn > 0 ? (
                <>
                  {bondUnits === 1 ? "Bu istiqraz" : "Bu istiqrazlar"} sizə ayda{" "}
                  <span className="num font-semibold text-ink dark:text-white/90">
                    {formatGrouped(bondMonthlyAzn, 2)} ₼
                  </span>{" "}
                  qazandırır.
                </>
              ) : null
            }
            note={
              <>
                Qeyd: istiqrazlar nominal dəyəri ilə — müddətin sonunda geri qaytarılacaq
                məbləğlə — hesablanır. Kupon ödənişləri bu məbləğə daxil deyil, ayrıca
                ödənilir. Yalnız aktiv buraxılışlar sayılır: nominalı artıq ödənilmiş
                buraxılış balansdan çıxır.
              </>
            }
            tone="blue"
          />
        </div>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-black/55 dark:text-white/60">
            {termMonths != null ? (
              <span>
                müddət{" "}
                <span className="font-medium text-black/70 dark:text-white/75">
                  {termMonths} ay
                </span>
              </span>
            ) : null}
            {annualRatePct != null ? (
              <span>
                · illik{" "}
                <span className="font-medium text-black/70 dark:text-white/75">
                  {formatPercent(annualRatePct)}
                </span>
              </span>
            ) : null}
            {maturityEndAmount != null ? (
              <span>
                müddət sonu{" "}
                <span className="font-medium text-brand-green-deep dark:text-emerald-400">
                  {formatAmount(maturityEndAmount)}₼
                </span>
                {maturityDateLabel ? (
                  <span className="text-black/45 dark:text-white/50"> ({maturityDateLabel})</span>
                ) : null}
              </span>
            ) : null}
          </div>
          {hasDeposit ? (
            <p className="mt-4 text-xs leading-5 text-black/45 dark:text-white/50">
              {depositMonthlyAzn > 0 ? (
                <>
                  Bu depozit sizə ayda{" "}
                  <span className="num font-semibold text-ink dark:text-white/90">
                    {formatGrouped(depositMonthlyAzn, 2)} ₼
                  </span>{" "}
                  qazandırır.{" "}
                </>
              ) : null}
              {depositNote}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
