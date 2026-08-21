// Personal /bank balance "hero": one big number for everything İsmayılBank
// owes the holder — deposit principal + bonds at nominal. Redesigned as ONE
// card in the CreditPanel language: the composition bar under the figure
// splits the total into its two legs (dot colors match the segments), each
// leg carries its facts as a short meta line plus an earnings chip, and the
// long small-print "Qeyd" paragraphs collapse into native <details>
// disclosures so they stop dominating the section. Server component — the
// only client piece is the Odometer the figure already used.
//
// With no bonds the same card renders the deposit-only story (no bar, no
// legs); with neither product it is just the 0,00 ₼ answer to "what do I
// have here" and the page's empty-state copy takes over below.
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

function EarningsChip({ amountAzn }: { amountAzn: number }) {
  return (
    <span className="num inline-flex whitespace-nowrap rounded-full bg-brand-green-mist dark:bg-brand-green/15 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-status-paid dark:text-emerald-400">
      ayda +{formatGrouped(amountAzn, 2)} ₼
    </span>
  );
}

function NoteDisclosure({ children }: { children: React.ReactNode }) {
  return (
    <details className="group mt-3">
      <summary className="cursor-pointer list-none text-[11px] font-semibold text-black/40 dark:text-white/45 transition hover:text-bank-blue dark:hover:text-blue-400 [&::-webkit-details-marker]:hidden">
        Qeyd{" "}
        <span aria-hidden className="inline-block transition group-open:rotate-90">
          ▸
        </span>
      </summary>
      <p className="mt-2 text-[11px] leading-[1.5] text-black/45 dark:text-white/50">
        {children}
      </p>
    </details>
  );
}

function Leg({
  dotClass,
  label,
  amountAzn,
  meta,
  monthlyAzn,
  note,
}: {
  dotClass: string;
  label: string;
  amountAzn: number;
  meta?: React.ReactNode;
  monthlyAzn: number;
  note: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span aria-hidden className={`h-2 w-2 rounded-full ${dotClass}`} />
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/50">
          {label}
        </p>
      </div>
      <p className="num mt-2 text-[1.6rem] font-semibold leading-none tracking-[-0.02em] tabular-nums text-ink dark:text-white/90">
        {formatAmount(amountAzn)}
        <span className="ml-0.5 text-[1.05rem] font-medium text-black/40 dark:text-white/45">₼</span>
      </p>
      {meta ? (
        <p className="mt-1.5 text-[11px] leading-5 text-black/45 dark:text-white/50">
          {meta}
        </p>
      ) : null}
      {monthlyAzn > 0 ? (
        <p className="mt-2.5">
          <EarningsChip amountAzn={monthlyAzn} />
        </p>
      ) : null}
      <NoteDisclosure>{note}</NoteDisclosure>
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
  const monthlyTotalAzn =
    Math.max(0, depositMonthlyAzn) + Math.max(0, bondMonthlyAzn);
  const depositPct = totalAzn > 0 ? (depositedAzn / totalAzn) * 100 : 0;
  const maturityEndAmount =
    maturityBonusAzn != null ? depositedAzn + maturityBonusAzn : null;
  const maturityDateLabel = formatDisplayDate(maturityDate);

  const depositNote = (
    <>
      Depozit üzrə hesablanmış faiz yalnız depozit müddətinin sonunda
      {maturityDateLabel ? ` (${maturityDateLabel})` : ""} ödənilir. Vaxtından əvvəl
      çıxarılan depozitlərə faiz gəliri verilmir.
    </>
  );

  // Degenerate tiers read as noise, not facts — a 0-month term or a 0% rate
  // simply drops out of the meta line.
  const depositMeta = (
    <>
      {termMonths != null && termMonths > 0 ? <>müddət {termMonths} ay</> : null}
      {termMonths != null && termMonths > 0 && annualRatePct != null && annualRatePct > 0
        ? " · "
        : null}
      {annualRatePct != null && annualRatePct > 0 ? (
        <>illik {formatPercent(annualRatePct)}</>
      ) : null}
      {maturityEndAmount != null && maturityEndAmount !== depositedAzn ? (
        <>
          {(termMonths != null && termMonths > 0) ||
          (annualRatePct != null && annualRatePct > 0)
            ? " · "
            : null}
          müddət sonu{" "}
          <span className="num font-semibold text-brand-green-deep dark:text-emerald-400">
            {formatAmount(maturityEndAmount)} ₼
          </span>
        </>
      ) : null}
      {maturityDateLabel ? (
        <>
          {" "}
          ({maturityDateLabel}
          {maturityEndAmount == null || maturityEndAmount === depositedAzn
            ? "-dək"
            : ""}
          )
        </>
      ) : null}
    </>
  );

  return (
    <section className="rounded-hero border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/10 p-6 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {/* "Depozit balansım" only when the deposit IS the whole balance —
            calling an empty balance a deposit balance would imply a deposit
            that isn't there. */}
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/50">
          {hasDeposit && !hasBonds ? "Depozit balansım" : "Ümumi balansım"}
        </p>
        {monthlyTotalAzn > 0 ? <EarningsChip amountAzn={monthlyTotalAzn} /> : null}
      </div>

      <div
        className="num mt-3 font-semibold leading-none tracking-[-0.03em] text-ink dark:text-white/90"
        style={{ fontSize: "clamp(2.6rem, 7vw, 3.6rem)" }}
      >
        <Odometer value={totalAzn} fractionDigits={2} suffix="₼" />
      </div>

      {/* Composition bar: how the total splits between the two products.
          Segment colors match the leg dots below. */}
      {hasBonds && hasDeposit && totalAzn > 0 ? (
        <div className="mt-5 flex h-2 w-full gap-0.5 overflow-hidden rounded-full" aria-hidden>
          <span
            className="h-full rounded-l-full bg-bank-blue dark:bg-blue-500"
            style={{ width: `${depositPct}%` }}
          />
          <span className="h-full flex-1 rounded-r-full bg-sky-400 dark:bg-sky-400" />
        </div>
      ) : null}

      {hasBonds ? (
        <div className="mt-5 grid grid-cols-1 gap-6 border-t border-black/10 dark:border-white/10 pt-5 sm:grid-cols-2 sm:gap-8">
          {hasDeposit ? (
            <Leg
              dotClass="bg-bank-blue dark:bg-blue-500"
              label="Depozit"
              amountAzn={depositedAzn}
              meta={depositMeta}
              monthlyAzn={depositMonthlyAzn}
              note={depositNote}
            />
          ) : null}
          <Leg
            dotClass="bg-sky-400"
            label="İstiqraz"
            amountAzn={bondValueAzn}
            meta={
              <>
                <span className="num">{formatUnits(bondUnits)}</span> istiqraz ·{" "}
                <span className="num">{bondIssues}</span> buraxılış · nominal dəyər
              </>
            }
            monthlyAzn={bondMonthlyAzn}
            note={
              <>
                İstiqrazlar nominal dəyəri ilə — müddətin sonunda geri qaytarılacaq
                məbləğlə — hesablanır. Kupon ödənişləri bu məbləğə daxil deyil, ayrıca
                ödənilir. Yalnız aktiv buraxılışlar sayılır: nominalı artıq ödənilmiş
                buraxılış balansdan çıxır.
              </>
            }
          />
        </div>
      ) : hasDeposit ? (
        <div className="mt-4">
          {/* The header chip already carries the monthly figure — deposit-only
              means it IS the deposit's, so no per-leg repeat here. */}
          <p className="text-[13px] leading-6 text-black/55 dark:text-white/60">
            {depositMeta}
          </p>
          <NoteDisclosure>{depositNote}</NoteDisclosure>
        </div>
      ) : null}
    </section>
  );
}
