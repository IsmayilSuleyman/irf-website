import { formatAzn, formatGroupedTrim } from "@/lib/portfolio";
import { formatBakuDate } from "@/lib/user";
import { azTitleCase, type BankWideAggregate } from "@/lib/bank";
import type { LiquidityProjectionPoint } from "@/lib/liquidityProjection";
import { LiquidityProjectionChart } from "@/components/LiquidityProjectionChart";
import { Odometer } from "@/components/Odometer";

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

function PersonRow({
  name,
  primary,
  secondary,
  pill,
  primaryMuted = false,
}: {
  name: string;
  primary: string;
  secondary?: string;
  pill?: { text: string; tone: "paid" | "due" | "info" };
  primaryMuted?: boolean;
}) {
  const pillClass =
    pill?.tone === "paid"
      ? "bg-brand-green-mist dark:bg-brand-green/15 text-status-paid dark:text-emerald-400"
      : pill?.tone === "due"
        ? "bg-status-late-soft dark:bg-status-late/20 text-status-late dark:text-rose-400"
        : "bg-bank-blue-soft dark:bg-bank-blue/20 text-bank-blue dark:text-blue-400";

  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-5 py-3.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink dark:text-white/90">
          {azTitleCase(name)}
        </p>
        {secondary ? (
          <p className="mt-0.5 truncate text-xs text-black/45 dark:text-white/50">{secondary}</p>
        ) : null}
      </div>
      {pill ? (
        <span
          className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${pillClass}`}
        >
          {pill.text}
        </span>
      ) : (
        <span />
      )}
      <p
        className={`text-sm font-semibold tabular-nums ${
          primaryMuted ? "text-black/45 dark:text-white/50" : "text-ink dark:text-white/90"
        }`}
      >
        {primary}
      </p>
    </div>
  );
}

function ListSection({
  title,
  subtitle,
  headerRight,
  empty,
  children,
}: {
  title: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  empty?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/10">
      <header className="flex items-baseline justify-between gap-4 px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-ink dark:text-white/90">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-0.5 truncate text-xs text-black/45 dark:text-white/50">{subtitle}</p>
          ) : null}
        </div>
        {headerRight}
      </header>
      {children ? (
        <div className="divide-y divide-black/5 border-t border-black/10 dark:border-white/10">
          {children}
        </div>
      ) : empty ? (
        <p className="px-5 pb-5 text-sm text-black/45 dark:text-white/50">{empty}</p>
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
    <div className="mt-8 space-y-12">
      {/* Liquidity hero — net liquidity in big font, mirroring FundHero on the
          dashboard's Ümumfond view. Supporting breakdown sits underneath so the
          three subordinate numbers (deposits / loans / ratio) stay readable
          without the 4-tile grid competing for attention. */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-bank-blue dark:text-blue-400">
            Xalis likvidlik
          </p>
          <span className="text-[11px] font-medium text-black/45 dark:text-white/50">
            {depositors.length} depozitor · {borrowers.length} borc alan
          </span>
        </div>

        <div
          className="num font-black leading-none tracking-tight text-ink dark:text-white/90"
          style={{ fontSize: "clamp(3.25rem, 10vw, 6.5rem)" }}
        >
          <Odometer value={netLiquidityAzn} fractionDigits={2} suffix="₼" />
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-black/45 dark:text-white/50">
          <span>
            cəmi depozit{" "}
            <span className="font-medium text-black/70 dark:text-white/75">
              {formatAzn(totalDepositsAzn)}
            </span>
          </span>
          {bondFundingAzn > 0 ? (
            <span>
              · istiqraz vəsaiti{" "}
              <span className="font-medium text-bank-blue dark:text-blue-400">
                {formatAzn(bondFundingAzn)}
              </span>
            </span>
          ) : null}
          {totalLoansAzn > 0 ? (
            <span>
              · cəmi kredit{" "}
              <span className="font-medium text-status-late dark:text-rose-400">
                {formatAzn(totalLoansAzn)}
              </span>
            </span>
          ) : null}
          <span>
            · likvidlik nisbəti{" "}
            <span className="font-medium text-black/70 dark:text-white/75">
              {liquidityPctLabel}
            </span>
          </span>
        </div>

        <div className="space-y-1.5 pt-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
            <div
              className="h-full rounded-l-full bg-status-late/70 transition-all"
              style={{ width: `${loanShareOfFundingPct}%` }}
            />
          </div>
          <div className="flex gap-4 text-[11px] font-medium text-black/45 dark:text-white/50">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-status-late/70" />
              Kredit
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-black/10 dark:bg-white/15" />
              Azad likvidlik
            </span>
          </div>
        </div>

        {totalPendingBonusAzn > 0 ? (
          <div className="space-y-1 pt-1 text-xs leading-5 text-black/45 dark:text-white/50">
            <p>
              Depozitlər üzrə cəmi faiz qazancı:{" "}
              <span className="font-semibold text-ink dark:text-white/90">
                {formatAzn(totalPendingBonusAzn)}
              </span>
              . Bu məbləğ müvafiq müddətlərin sonunda depozitorlara ödəniləcək.
            </p>
            {totalAccruedInterestAzn > 0 || totalMonthlyInterestAzn > 0 ? (
              <p>
                Bu günə artıq aylıq qazanılıb:{" "}
                <span className="font-semibold text-brand-green-deep dark:text-emerald-400">
                  {formatAzn(totalAccruedInterestAzn)}
                </span>
                {totalMonthlyInterestAzn > 0 ? (
                  <>
                    {" "}· cari aylıq qazanc:{" "}
                    <span className="font-semibold text-ink dark:text-white/90">
                      {formatAzn(totalMonthlyInterestAzn)}
                    </span>
                    /ay
                  </>
                ) : null}
                .
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* Projected liquidity — cumulative walk over every known scheduled
          cash event. Rendered only when there is at least one future event. */}
      {projection && projection.length >= 2 ? (
        <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/10 p-6">
          <div className="flex items-baseline justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-ink dark:text-white/90">
                Proqnozlaşdırılan likvidlik
              </h2>
              <p className="mt-0.5 text-xs text-black/45 dark:text-white/50">
                Cədvəl üzrə kredit qaytarımları, depozit çıxışları və istiqraz
                ödənişləri əsasında — nöqtənin üzərinə gələrək günün hadisələrini görün
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/50">
                Dövr sonu
              </p>
              <p
                className={`num text-sm font-semibold ${
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

      {/* 30-day depositor payouts (interest out) */}
      <ListSection
        title="30 gün ərzində ödəniləcək faiz"
        subtitle="Müddəti yaxınlaşan depozitlərə görə bankın çıxış axını"
        headerRight={
          <span className="text-sm font-semibold tabular-nums text-status-late dark:text-rose-400">
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
                primary={formatAzn(p.amountAzn)}
                secondary={`${formatDateMaybe(p.date)} · ${relativeDays(p.daysAway)}`}
              />
            ))
          : null}
      </ListSection>

      {/* 30-day loan inflow — paid items stay in the list with an "Ödənilib"
          pill so the borrower is still surfaced; only unpaid amounts count
          toward the green total at the top. */}
      <ListSection
        title="30 gün ərzində gözlənilən kredit qaytarımları"
        subtitle="Ödəniş cədvəlinə əsasən bankın giriş axını"
        headerRight={
          next30dInflow.items.length === 0 ? (
            <span className="text-sm font-semibold tabular-nums text-black/45 dark:text-white/50">
              —
            </span>
          ) : next30dInflow.totalAzn > 0 ? (
            <span className="text-sm font-semibold tabular-nums text-brand-green-deep dark:text-emerald-400">
              +{formatAzn(next30dInflow.totalAzn)}
            </span>
          ) : (
            <span className="text-sm font-semibold tabular-nums text-black/45 dark:text-white/50">
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
                primary={formatAzn(p.amountAzn)}
                secondary={`${formatDateMaybe(p.date)} · ${relativeDays(p.daysAway)}${p.label ? ` · ${p.label}` : ""}`}
                pill={p.paid ? { text: "Ödənilib", tone: "paid" } : undefined}
                primaryMuted={p.paid}
              />
            ))
          : null}
      </ListSection>

      {/* Full depositors */}
      <ListSection
        title="Depozitorlar"
        headerRight={
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/50">
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

      {/* Full borrowers */}
      <ListSection
        title="Borc alanlar"
        headerRight={
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/50">
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
  );
}
