import { formatAzn, formatGrouped, formatGroupedTrim } from "@/lib/portfolio";
import { formatBakuDate } from "@/lib/user";
import { azTitleCase, type BankWideAggregate } from "@/lib/bank";
import type { LiquidityProjectionPoint } from "@/lib/liquidityProjection";
import { LiquidityProjectionChart } from "@/components/LiquidityProjectionChartLazy";
import { Odometer } from "@/components/Odometer";

// Ümumbank baxışı in the bank's card language (CreditPanel / BalanceHero):
// one balance-sheet hero card — figure, funding bar, stat tiles and the
// interest obligations as a quiet strip — then the projection chart, and the
// four person lists paired into two-column grids (out-vs-in flows,
// depositors-vs-borrowers) so mirror-image data reads side by side instead
// of as four full-width stacks.

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

function StatTile({
  label,
  value,
  tone = "text-ink dark:text-white/90",
  title,
}: {
  label: string;
  value: string;
  tone?: string;
  title?: string;
}) {
  return (
    <div
      title={title}
      className="min-w-[8.5rem] flex-1 basis-[calc(50%-0.75rem)] rounded-card border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/5 px-4 py-3.5 sm:basis-0"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/45 dark:text-white/50">
        {label}
      </p>
      <p className={`num mt-1.5 text-[1.25rem] font-semibold tracking-[-0.02em] tabular-nums ${tone}`}>
        {value}
      </p>
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

export function BankWideView({
  aggregate,
  projection,
}: {
  aggregate: BankWideAggregate;
  projection?: LiquidityProjectionPoint[];
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
    totalAccruedInterestAzn,
    totalMonthlyInterestAzn,
    depositors,
    borrowers,
    next30dPayouts,
    next30dInflow,
  } = aggregate;

  const liquidityPctLabel =
    liquidityPct == null ? "—" : `${formatGroupedTrim(liquidityPct, 0)}%`;

  return (
    <div className="mt-8 space-y-6">
      {/* ── Balance-sheet hero: the net figure, how funding is used, and the
          bank's standing interest obligations — one card. ── */}
      <section className="rounded-hero border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/10 p-6 sm:p-7">
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
          />
          {bondFundingAzn > 0 ? (
            <StatTile
              label="İstiqraz vəsaiti"
              value={`${formatAmount(bondFundingAzn)} ₼`}
              tone="text-bank-blue dark:text-blue-400"
            />
          ) : null}
          {assetReserveAzn > 0 ? (
            <StatTile
              label="Aktivlər ehtiyatı"
              value={`${formatAmount(assetReserveAzn)} ₼`}
              title="Holderların ETF alışlarını təmin edən vəsait — faizsiz, toxunulmaz; kredit resurslarına və xalis likvidliyə daxil deyil."
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
          />
          <StatTile
            label="Likvidlik nisbəti"
            value={liquidityPctLabel}
            tone={
              liquidityPct == null
                ? "text-ink dark:text-white/90"
                : liquidityTone(liquidityPct)
            }
          />
        </div>

        {/* Standing interest obligations to depositors — three quiet stats
            with the payment-timing small print behind a disclosure. */}
        {totalPendingBonusAzn > 0 ? (
          <div className="mt-6 border-t border-black/10 dark:border-white/10 pt-5">
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/45 dark:text-white/50">
                  Gözlənilən faiz ödənişi
                </p>
                <p className="num mt-1 text-[15px] font-semibold tabular-nums text-ink dark:text-white/90">
                  {formatAzn(totalPendingBonusAzn)}
                </p>
              </div>
              {totalAccruedInterestAzn > 0 ? (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/45 dark:text-white/50">
                    Bu günə qazanılıb
                  </p>
                  <p className="num mt-1 text-[15px] font-semibold tabular-nums text-brand-green-deep dark:text-emerald-400">
                    {formatAzn(totalAccruedInterestAzn)}
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
                Depozitlər üzrə hesablanmış faiz qazancı müvafiq müddətlərin
                sonunda depozitorlara ödənilir; buradakı məbləğlər bankın
                gələcək öhdəliyini göstərir.
              </p>
            </details>
          </div>
        ) : null}
      </section>

      {/* ── Projected liquidity — cumulative walk over every known scheduled
          cash event. Rendered only when there is at least one future event. ── */}
      {projection && projection.length >= 2 ? (
        <section className="rounded-hero border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/10 p-6 sm:p-7">
          <div className="flex items-baseline justify-between gap-4">
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
            <div className="shrink-0 text-right">
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
          <div className="mt-4">
            <LiquidityProjectionChart points={projection} />
          </div>
        </section>
      ) : null}

      {/* ── 30-day flows, out and in, side by side. ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
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
                const parts: string[] = [];
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
    </div>
  );
}
