import Link from "next/link";
import { formatAzn, formatGrouped, formatGroupedTrim } from "@/lib/portfolio";
import { formatBakuDate } from "@/lib/user";
import { azTitleCase, type BankWideAggregate } from "@/lib/bank";
import type {
  BondObligations,
  LiquidityProjectionPoint,
} from "@/lib/liquidityProjection";
import type { BankHealth, DepositCoverage } from "@/lib/bankHealth";
import type { BankTrendSeries } from "@/lib/bankSnapshots";
import { DAILY_DEPOSIT_EFFECTIVE_ANNUAL_PCT } from "@/lib/bankTermsData";
import { LiquidityProjectionChart } from "@/components/LiquidityProjectionChartLazy";
import { Odometer } from "@/components/Odometer";
import { sparkPath } from "@/components/RowSpark";
import { BankHealthBanner } from "@/components/BankHealthBanner";
import { BankGuaranteeCard } from "@/components/BankGuaranteeCard";
import { BankBalanceSheet } from "@/components/BankBalanceSheet";
import { BankObligationsCard } from "@/components/BankObligationsCard";

// Ümumbank baxışı in the bank's card language (CreditPanel / BalanceHero),
// ordered the way a depositor actually reads it: the VERDICT first (health
// banner), then the balance-sheet hero (figure, funding bar, stat tiles
// with daily-snapshot sparklines, the interest strip), the İsmayıl
// guarantee certificate with its coverage ratio, the two-column balance
// sheet, the full obligations list, the projection chart, overdue +
// 30-day flows, the person lists, and a deposit CTA to close. A chip
// quick-nav up top keeps the long page navigable.

// === Tiny presentational helpers (component-local on purpose) ===

function formatDateMaybe(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isFinite(d.valueOf()) ? formatBakuDate(d) : iso;
}

function relativeDays(days: number): string {
  if (days === 0) return "bu gün";
  if (days === 1) return "sabah";
  if (days === -1) return "dünən";
  if (days > 0) return `${days} gündən sonra`;
  return `${-days} gün əvvəl`;
}

function formatAmount(value: number): string {
  const hasFraction = Math.abs(value % 1) > 0.001;
  return formatGrouped(value, hasFraction ? 2 : 0);
}

// Neutral daily-trend backdrop for a stat tile — the RowSpark recipe in
// the bank's blue, deliberately directionless (a growing loan book isn't
// "bad" the way a falling price is).
function TileTrend({ values, id }: { values: number[]; id: string }) {
  const line = sparkPath(values, 100, 26, 3);
  if (!line) return null;
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-x-2 bottom-1 h-8 text-bank-blue dark:text-blue-400"
    >
      <svg viewBox="0 0 100 26" preserveAspectRatio="none" className="h-full w-full">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.14" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${line} L100 26 L0 26 Z`} fill={`url(#${id})`} />
        <path
          d={line}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.35"
        />
      </svg>
    </span>
  );
}

function StatTile({
  label,
  value,
  tone = "text-ink dark:text-white/90",
  hint,
  spark,
  sparkId,
}: {
  label: string;
  value: string;
  tone?: string;
  /** Plain-language one-liner under the figure — always visible, unlike a
   *  hover tooltip a phone can never open. */
  hint?: string;
  spark?: number[];
  sparkId?: string;
}) {
  return (
    <div className="relative min-w-[8.5rem] flex-1 basis-[calc(50%-0.75rem)] overflow-hidden rounded-card border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/5 px-4 py-3.5 sm:basis-0">
      {spark && spark.length >= 2 && sparkId ? (
        <TileTrend values={spark} id={sparkId} />
      ) : null}
      <div className="relative">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/45 dark:text-white/50">
          {label}
        </p>
        <p
          className={`num mt-1.5 text-[1.25rem] font-semibold tracking-[-0.02em] tabular-nums ${tone} ${
            spark && spark.length >= 2 ? "tile-figure" : ""
          }`}
        >
          {value}
        </p>
        {hint ? (
          <p className="mt-1 text-[10px] leading-[1.4] text-black/40 dark:text-white/45">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function liquidityTone(pct: number): string {
  if (pct >= 60) return "text-status-paid dark:text-emerald-400";
  if (pct >= 30) return "text-status-warn dark:text-amber-400";
  return "text-status-late dark:text-rose-400";
}

function PersonRow({
  name,
  primary,
  secondary,
  pill,
  amountTone = "ink",
}: {
  name: string;
  primary: string;
  secondary?: string;
  pill?: { text: string; tone: "paid" | "due" | "info" };
  /** ink = neutral; pos/neg color the flow direction; muted for settled rows. */
  amountTone?: "ink" | "pos" | "neg" | "muted";
}) {
  const pillClass =
    pill?.tone === "paid"
      ? "bg-brand-green-mist dark:bg-brand-green/15 text-status-paid dark:text-emerald-400"
      : pill?.tone === "due"
        ? "bg-status-late-soft dark:bg-status-late/20 text-status-late dark:text-rose-400"
        : "bg-bank-blue-soft dark:bg-bank-blue/20 text-bank-blue dark:text-blue-400";

  const amountClass =
    amountTone === "pos"
      ? "text-brand-green-deep dark:text-emerald-400"
      : amountTone === "neg"
        ? "text-status-late dark:text-rose-400"
        : amountTone === "muted"
          ? "text-black/45 dark:text-white/50"
          : "text-ink dark:text-white/90";

  const displayName = azTitleCase(name);

  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <span
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bank-blue-soft dark:bg-bank-blue/15 text-[12px] font-semibold text-bank-blue dark:text-blue-400"
      >
        {displayName.charAt(0)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink dark:text-white/90">
          {displayName}
        </p>
        {secondary ? (
          <p className="mt-0.5 truncate text-[11px] text-black/45 dark:text-white/50">
            {secondary}
          </p>
        ) : null}
      </div>
      {pill ? (
        <span
          className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${pillClass}`}
        >
          {pill.text}
        </span>
      ) : null}
      <p className={`num shrink-0 text-sm font-semibold tabular-nums ${amountClass}`}>
        {primary}
      </p>
    </div>
  );
}

function ListSection({
  label,
  title,
  headerRight,
  empty,
  children,
}: {
  label: string;
  title: string;
  headerRight?: React.ReactNode;
  empty?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-hero border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/10">
      <header className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/50">
            {label}
          </p>
          <h2 className="mt-1 truncate text-[15px] font-semibold tracking-[-0.02em] text-ink dark:text-white/90">
            {title}
          </h2>
        </div>
        {headerRight}
      </header>
      {children ? (
        <div className="divide-y divide-black/5 dark:divide-white/5 border-t border-black/10 dark:border-white/10 pb-1.5 pt-1">
          {children}
        </div>
      ) : empty ? (
        <p className="border-t border-black/10 dark:border-white/10 px-5 py-4 text-sm text-black/45 dark:text-white/50 sm:px-6">
          {empty}
        </p>
      ) : null}
    </section>
  );
}

// === Main view ===

const QUICK_NAV = [
  { href: "#veziyyet", label: "Vəziyyət" },
  { href: "#likvidlik", label: "Likvidlik" },
  { href: "#zemanet", label: "Zəmanət" },
  { href: "#balans", label: "Balans" },
  { href: "#ohdelikler", label: "Öhdəliklər" },
  { href: "#proqnoz", label: "Proqnoz" },
  { href: "#axinlar", label: "Axınlar" },
  { href: "#istirakcilar", label: "İştirakçılar" },
] as const;

export function BankWideView({
  aggregate,
  projection,
  bondObligations,
  coverage,
  health,
  trend,
  unsettledAvailable,
  updatedLabel,
}: {
  aggregate: BankWideAggregate;
  projection?: LiquidityProjectionPoint[];
  bondObligations: BondObligations;
  coverage: DepositCoverage | null;
  health: BankHealth;
  trend: BankTrendSeries | null;
  unsettledAvailable: boolean;
  updatedLabel?: string;
}) {
  const {
    totalDepositsAzn,
    bondFundingAzn,
    assetReserveAzn,
    totalLoansAzn,
    netLiquidityAzn,
    liquidityPct,
    loanShareOfFundingPct,
    totalPendingBonusAzn,
    totalMonthlyInterestAzn,
    unsettledInterestAzn,
    unsettledRewardsAzn,
    settledInterestAzn,
    settledRewardsAzn,
    depositors,
    borrowers,
    next30dPayouts,
    next30dInflow,
    overdue,
  } = aggregate;

  const liquidityPctLabel =
    liquidityPct == null ? "—" : `${formatGroupedTrim(liquidityPct, 0)}%`;
  const unsettledTotalAzn = unsettledInterestAzn + unsettledRewardsAzn;
  const settledTotalAzn = settledInterestAzn + settledRewardsAzn;
  const interestStripVisible =
    totalPendingBonusAzn > 0 ||
    unsettledTotalAzn > 0 ||
    settledTotalAzn > 0 ||
    totalMonthlyInterestAzn > 0;
  const minProjection =
    projection && projection.length >= 2
      ? projection.reduce((a, b) => (b.valueAzn < a.valueAzn ? b : a))
      : null;

  return (
    <div className="mt-8 space-y-6">
      {/* ── Chip quick-nav — the page got long, jumps keep it honest. ── */}
      <nav aria-label="Bölmələr" className="flex flex-wrap gap-1.5">
        {QUICK_NAV.map((n) => (
          <a
            key={n.href}
            href={n.href}
            className="rounded-full border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-1 text-[11px] font-medium text-black/55 dark:text-white/60 transition hover:border-bank-blue/40 hover:text-bank-blue dark:hover:text-blue-400"
          >
            {n.label}
          </a>
        ))}
      </nav>

      {/* ── The verdict, before any number. ── */}
      <BankHealthBanner health={health} updatedLabel={updatedLabel} />

      {/* ── Balance-sheet hero: the net figure, how funding is used, and the
          bank's standing interest obligations — one card. ── */}
      <section
        id="likvidlik"
        className="scroll-mt-6 rounded-hero border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/10 p-6 sm:p-7"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/50">
            Xalis likvidlik
          </p>
          <span className="text-[11px] font-medium text-black/45 dark:text-white/50">
            {depositors.length} depozitor · {borrowers.length} borc alan
          </span>
        </div>

        <div
          className="num mt-3 font-semibold leading-none tracking-[-0.03em] text-ink dark:text-white/90"
          style={{ fontSize: "clamp(2.6rem, 7vw, 3.6rem)" }}
        >
          <Odometer value={netLiquidityAzn} fractionDigits={2} suffix="₼" />
        </div>
        <p className="mt-2 text-xs text-black/45 dark:text-white/50">
          bankın istənilən an geri ödəyə biləcəyi sərbəst pulu
        </p>

        {/* Funding usage: loans carve into the green free-liquidity track —
            same bar the İsmayılBank page's liquidity card draws. */}
        <div className="mt-5 flex h-2 w-full overflow-hidden rounded-full bg-brand-green/25 dark:bg-emerald-500/25" aria-hidden>
          <div
            className="h-full rounded-r-full bg-status-late/80 transition-all"
            style={{ width: `${loanShareOfFundingPct}%` }}
          />
        </div>
        <div className="mt-2 flex gap-4 text-[11px] font-medium text-black/45 dark:text-white/50">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-status-late/80" />
            Kredit
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-brand-green/40 dark:bg-emerald-500/40" />
            Azad likvidlik
          </span>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <StatTile
            label="Cəmi depozit"
            value={`${formatAmount(totalDepositsAzn)} ₼`}
            hint="iştirakçıların əmanətləri"
            spark={trend?.deposits}
            sparkId="bank-trend-deposits"
          />
          {bondFundingAzn > 0 ? (
            <StatTile
              label="İstiqraz vəsaiti"
              value={`${formatAmount(bondFundingAzn)} ₼`}
              tone="text-bank-blue dark:text-blue-400"
              hint="istiqraz satışından cəlb olunub"
            />
          ) : null}
          {assetReserveAzn > 0 ? (
            <StatTile
              label="Aktivlər ehtiyatı"
              value={`${formatAmount(assetReserveAzn)} ₼`}
              hint="toxunulmaz — kreditə verilmir"
            />
          ) : null}
          <StatTile
            label="Cəmi kredit"
            value={`${formatAmount(totalLoansAzn)} ₼`}
            tone={
              totalLoansAzn > 0
                ? "text-status-late dark:text-rose-400"
                : "text-ink dark:text-white/90"
            }
            hint="borc alanlardakı qalıq"
            spark={trend?.loans}
            sparkId="bank-trend-loans"
          />
          <StatTile
            label="Likvidlik nisbəti"
            value={liquidityPctLabel}
            tone={
              liquidityPct == null
                ? "text-ink dark:text-white/90"
                : liquidityTone(liquidityPct)
            }
            hint="sərbəst pulun cəlb olunmuş vəsaitə nisbəti"
          />
          <StatTile
            label="Gecikmiş ödəniş"
            value={overdue.items.length === 0 ? "Yoxdur ✓" : `−${formatAmount(overdue.totalAzn)} ₼`}
            tone={
              overdue.items.length === 0
                ? "text-status-paid dark:text-emerald-400"
                : "text-status-late dark:text-rose-400"
            }
            hint={
              overdue.items.length === 0
                ? "bütün ödənişlər vaxtında"
                : `${overdue.items.length} ödənişin vaxtı keçib`
            }
          />
        </div>

        {/* Standing interest obligations — the term product's pending
            bonuses, the daily ledger's unsettled bucket, and (the trust
            line) what has already been paid out. The old strip gated on
            term bonuses alone, so a bank with only daily-product
            depositors showed no interest obligations at all. */}
        {interestStripVisible ? (
          <div className="mt-6 border-t border-black/10 dark:border-white/10 pt-5">
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              {totalPendingBonusAzn > 0 ? (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/45 dark:text-white/50">
                    Gözlənilən faiz ödənişi
                  </p>
                  <p className="num mt-1 text-[15px] font-semibold tabular-nums text-ink dark:text-white/90">
                    {formatAzn(totalPendingBonusAzn)}
                  </p>
                </div>
              ) : null}
              {unsettledTotalAzn > 0 ? (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/45 dark:text-white/50">
                    Hesablaşılmamış (günlük)
                  </p>
                  <p className="num mt-1 text-[15px] font-semibold tabular-nums text-ink dark:text-white/90">
                    {formatAzn(unsettledTotalAzn)}
                  </p>
                </div>
              ) : null}
              {settledTotalAzn > 0 ? (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/45 dark:text-white/50">
                    Bu günə ödənilib
                  </p>
                  <p className="num mt-1 text-[15px] font-semibold tabular-nums text-brand-green-deep dark:text-emerald-400">
                    {formatAzn(settledTotalAzn)}
                  </p>
                </div>
              ) : null}
              {totalMonthlyInterestAzn > 0 ? (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/45 dark:text-white/50">
                    Cari aylıq qazanc
                  </p>
                  <p className="num mt-1 text-[15px] font-semibold tabular-nums text-ink dark:text-white/90">
                    {formatAzn(totalMonthlyInterestAzn)}/ay
                  </p>
                </div>
              ) : null}
            </div>
            <details className="group mt-3">
              <summary className="cursor-pointer list-none text-[11px] font-semibold text-black/40 dark:text-white/45 transition hover:text-bank-blue dark:hover:text-blue-400 [&::-webkit-details-marker]:hidden">
                Qeyd{" "}
                <span aria-hidden className="inline-block transition group-open:rotate-90">
                  ▸
                </span>
              </summary>
              <p className="mt-2 text-[11px] leading-[1.5] text-black/45 dark:text-white/50">
                Müddətli depozitlərin faizi müddətin sonunda ödənilir. Günlük
                faiz və mükafatlar hər gün hesablanır, «hesablaşılmamış»
                bucketində toplanır və İsmayıl onları Sheet depozitinə
                köçürəndə ödənilmiş sayılır. Buradakı məbləğlər bankın
                depozitorlar qarşısındakı öhdəliyidir.
              </p>
            </details>
          </div>
        ) : null}
      </section>

      {/* ── The İsmayıl guarantee, with its coverage ratio. ── */}
      <BankGuaranteeCard coverage={coverage} />

      {/* ── Two mirrored columns: where the money comes from / where it sits. ── */}
      <BankBalanceSheet
        depositsAzn={totalDepositsAzn}
        bondFundingAzn={bondFundingAzn}
        assetReserveAzn={assetReserveAzn}
        loansAzn={totalLoansAzn}
        netLiquidityAzn={netLiquidityAzn}
      />

      {/* ── Every standing promise, summed. ── */}
      <BankObligationsCard
        aggregate={aggregate}
        bondObligations={bondObligations}
        unsettledAvailable={unsettledAvailable}
      />

      {/* ── Projected liquidity — cumulative walk over every known scheduled
          cash event. Rendered only when there is at least one future event. ── */}
      {projection && projection.length >= 2 ? (
        <section
          id="proqnoz"
          className="scroll-mt-6 rounded-hero border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/10 p-6 sm:p-7"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/50">
                Proqnoz
              </p>
              <h2 className="mt-1 text-[15px] font-semibold tracking-[-0.02em] text-ink dark:text-white/90">
                Proqnozlaşdırılan likvidlik
              </h2>
              <p className="mt-0.5 text-xs text-black/45 dark:text-white/50">
                Cədvəl üzrə kredit qaytarımları, depozit çıxışları və istiqraz
                ödənişləri əsasında — nöqtənin üzərinə gələrək günün
                hadisələrini görün
              </p>
            </div>
            <div className="flex shrink-0 gap-6 text-right">
              {/* The walk's lowest point — the number that answers "can the
                  bank cover its worst day?". */}
              {minProjection ? (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/50">
                    Ən dar nöqtə
                  </p>
                  <p
                    className={`num text-sm font-semibold tabular-nums ${
                      minProjection.valueAzn < 0
                        ? "text-status-late dark:text-rose-400"
                        : "text-ink dark:text-white/90"
                    }`}
                  >
                    {formatAzn(minProjection.valueAzn)}
                  </p>
                  <p className="text-[10px] text-black/40 dark:text-white/45">
                    {formatDateMaybe(minProjection.date)}
                  </p>
                </div>
              ) : null}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/50">
                  Dövr sonu
                </p>
                <p
                  className={`num text-sm font-semibold tabular-nums ${
                    projection[projection.length - 1].valueAzn < 0
                      ? "text-status-late dark:text-rose-400"
                      : "text-ink dark:text-white/90"
                  }`}
                >
                  {formatAzn(projection[projection.length - 1].valueAzn)}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <LiquidityProjectionChart points={projection} />
          </div>
        </section>
      ) : null}

      {/* ── Overdue, rendered ONLY when it exists — the tile above already
          says "Yoxdur ✓" on clean days, a permanently empty list would just
          be noise. ── */}
      {overdue.items.length > 0 ? (
        <ListSection
          label="Gecikmiş"
          title="Vaxtı keçmiş ödənişlər"
          headerRight={
            <span className="num text-sm font-semibold tabular-nums text-status-late dark:text-rose-400">
              {formatAzn(overdue.totalAzn)}
            </span>
          }
        >
          {overdue.items.map((p, i) => (
            <PersonRow
              key={`overdue-${p.name}-${p.date}-${i}`}
              name={p.name}
              primary={formatAzn(p.amountAzn)}
              amountTone="neg"
              secondary={`${formatDateMaybe(p.date)} · ${p.daysOverdue} gün gecikib${p.label ? ` · ${p.label}` : ""}`}
              pill={{ text: "Gecikir", tone: "due" }}
            />
          ))}
        </ListSection>
      ) : null}

      {/* ── 30-day flows, out and in, side by side. ── */}
      <div
        id="axinlar"
        className="grid scroll-mt-6 grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start"
      >
        <ListSection
          label="30 gün · çıxış"
          title="Ödəniləcək faiz"
          headerRight={
            <span className="num text-sm font-semibold tabular-nums text-status-late dark:text-rose-400">
              {next30dPayouts.items.length > 0
                ? `−${formatAzn(next30dPayouts.totalAzn)}`
                : "—"}
            </span>
          }
          empty="Növbəti 30 gün ərzində müddəti bitən depozit yoxdur."
        >
          {next30dPayouts.items.length > 0
            ? next30dPayouts.items.map((p, i) => (
                <PersonRow
                  key={`payout-${p.name}-${p.date}-${i}`}
                  name={p.name}
                  primary={`−${formatAzn(p.amountAzn)}`}
                  amountTone="neg"
                  secondary={`${formatDateMaybe(p.date)} · ${relativeDays(p.daysAway)}`}
                />
              ))
            : null}
        </ListSection>

        {/* Paid items stay in the list with an "Ödənilib" pill so the
            borrower is still surfaced; only unpaid amounts count toward the
            green total at the top. */}
        <ListSection
          label="30 gün · giriş"
          title="Gözlənilən kredit qaytarımları"
          headerRight={
            next30dInflow.items.length === 0 ? (
              <span className="num text-sm font-semibold tabular-nums text-black/45 dark:text-white/50">
                —
              </span>
            ) : next30dInflow.totalAzn > 0 ? (
              <span className="num text-sm font-semibold tabular-nums text-brand-green-deep dark:text-emerald-400">
                +{formatAzn(next30dInflow.totalAzn)}
              </span>
            ) : (
              <span className="num text-sm font-semibold tabular-nums text-black/45 dark:text-white/50">
                {formatAzn(0)}
              </span>
            )
          }
          empty="Növbəti 30 gün ərzində gözlənilən qaytarım yoxdur."
        >
          {next30dInflow.items.length > 0
            ? next30dInflow.items.map((p, i) => (
                <PersonRow
                  key={`inflow-${p.name}-${p.date}-${i}`}
                  name={p.name}
                  primary={p.paid ? formatAzn(p.amountAzn) : `+${formatAzn(p.amountAzn)}`}
                  amountTone={p.paid ? "muted" : "pos"}
                  secondary={`${formatDateMaybe(p.date)} · ${relativeDays(p.daysAway)}${p.label ? ` · ${p.label}` : ""}`}
                  pill={p.paid ? { text: "Ödənilib", tone: "paid" } : undefined}
                />
              ))
            : null}
        </ListSection>
      </div>

      {/* ── Everyone with a position, side by side. ── */}
      <div
        id="istirakcilar"
        className="grid scroll-mt-6 grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start"
      >
        <ListSection
          label="İştirakçılar"
          title="Depozitorlar"
          headerRight={
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/50">
              {depositors.length}
            </span>
          }
          empty="Hələ depozit yatıran yoxdur."
        >
          {depositors.length > 0
            ? depositors.map((d, i) => {
                // Empty term cells = the on-demand daily product (the same
                // rule the accrual RPC keys off) — name it, so daily rows
                // don't read as products with no terms.
                const isTermProduct =
                  (d.termMonths != null && d.termMonths > 0) ||
                  (d.annualRatePct != null && d.annualRatePct > 0);
                const parts: string[] = [];
                if (!isTermProduct) {
                  parts.push(
                    `tələbli · illik effektiv ${DAILY_DEPOSIT_EFFECTIVE_ANNUAL_PCT}%`,
                  );
                }
                if (d.termMonths != null) parts.push(`${d.termMonths} ay`);
                if (d.annualRatePct != null) {
                  parts.push(`${formatGroupedTrim(d.annualRatePct, 2)}%`);
                }
                if (d.maturityDate) {
                  parts.push(`bitir ${formatDateMaybe(d.maturityDate)}`);
                }
                if (d.maturityBonusAzn != null && d.maturityBonusAzn > 0) {
                  parts.push(`bonus ${formatAzn(d.maturityBonusAzn)}`);
                }
                if (d.accruedInterestAzn > 0) {
                  parts.push(`qazanılıb ${formatAzn(d.accruedInterestAzn)}`);
                }
                return (
                  <PersonRow
                    key={`dep-${d.name}-${i}`}
                    name={d.name}
                    primary={formatAzn(d.depositedAzn)}
                    secondary={parts.length > 0 ? parts.join(" · ") : undefined}
                  />
                );
              })
            : null}
        </ListSection>

        <ListSection
          label="İştirakçılar"
          title="Borc alanlar"
          headerRight={
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/50">
              {borrowers.length}
            </span>
          }
          empty="Hələ borc alan yoxdur."
        >
          {borrowers.length > 0
            ? borrowers.map((b, i) => {
                const parts: string[] = [];
                if (b.monthlyPaymentAzn != null && b.monthlyPaymentAzn > 0) {
                  parts.push(`aylıq ${formatAzn(b.monthlyPaymentAzn)}`);
                }
                if (b.nextPaymentDate) {
                  parts.push(
                    `növbəti ödəniş ${formatDateMaybe(b.nextPaymentDate)}`,
                  );
                }
                return (
                  <PersonRow
                    key={`bor-${b.name}-${i}`}
                    name={b.name}
                    primary={formatAzn(b.outstandingLoanAzn)}
                    secondary={parts.length > 0 ? parts.join(" · ") : undefined}
                  />
                );
              })
            : null}
        </ListSection>
      </div>

      {/* ── The bridge to action: the transparency page is also the bank's
          best sales page, and it used to dead-end here. Green = the
          deposit product's identity (the calculator's result panel). ── */}
      <section className="relative overflow-hidden rounded-hero bg-[linear-gradient(160deg,#16a34a_0%,#15803d_100%)] p-6 text-white sm:p-7">
        <div
          aria-hidden
          className="absolute -right-12 -top-16 h-44 w-44 rounded-full bg-white/10 blur-2xl"
        />
        <div className="relative flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
          <div className="min-w-0">
            <h2 className="text-[clamp(1.15rem,2.6vw,1.4rem)] font-black tracking-[-0.03em]">
              Pulun hər gün işləsin
            </h2>
            <p className="mt-1.5 max-w-[46ch] text-[13px] leading-[1.55] text-white/85">
              İllik effektiv {DAILY_DEPOSIT_EFFECTIVE_ANNUAL_PCT}% — faiz hər
              gün hesablanır, növbəti gün balansına əlavə olunur. İstənilən
              vaxt çıxarış, qazanılmış faiz itmir.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <Link
              href="/ismayilbank#depozit"
              className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-brand-green-deep transition hover:bg-white/90"
            >
              Depozit hesabla
            </Link>
            <Link
              href="/ismayilbank"
              className="text-[13px] font-medium text-white/85 underline decoration-white/40 underline-offset-4 transition hover:text-white"
            >
              Bütün şərtlər
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
