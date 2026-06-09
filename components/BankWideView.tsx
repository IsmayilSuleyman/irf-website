import { formatAzn, formatGroupedTrim } from "@/lib/portfolio";
import { formatBakuDate } from "@/lib/user";
import { azTitleCase, type BankWideAggregate } from "@/lib/bank";
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
      ? "bg-brand-green-mist text-status-paid"
      : pill?.tone === "due"
        ? "bg-status-late-soft text-status-late"
        : "bg-bank-blue-soft text-bank-blue";

  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-5 py-3.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink">
          {azTitleCase(name)}
        </p>
        {secondary ? (
          <p className="mt-0.5 truncate text-xs text-black/45">{secondary}</p>
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
          primaryMuted ? "text-black/35" : "text-ink"
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
    <section className="rounded-2xl border border-black/6 bg-white/90">
      <header className="flex items-baseline justify-between gap-4 px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-ink">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-0.5 truncate text-xs text-black/45">{subtitle}</p>
          ) : null}
        </div>
        {headerRight}
      </header>
      {children ? (
        <div className="divide-y divide-black/6 border-t border-black/6">
          {children}
        </div>
      ) : empty ? (
        <p className="px-5 pb-5 text-sm text-black/45">{empty}</p>
      ) : null}
    </section>
  );
}

// === Main view ===

export function BankWideView({ aggregate }: { aggregate: BankWideAggregate }) {
  const {
    totalDepositsAzn,
    totalLoansAzn,
    netLiquidityAzn,
    liquidityPct,
    loanShareOfDepositsPct,
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-bank-blue">
            Xalis likvidlik
          </p>
          <span className="text-[11px] font-medium text-black/45">
            {depositors.length} depozitor · {borrowers.length} borc alan
          </span>
        </div>

        <div
          className="num font-black leading-none tracking-tight text-ink"
          style={{ fontSize: "clamp(3.25rem, 10vw, 6.5rem)" }}
        >
          <Odometer value={netLiquidityAzn} fractionDigits={2} suffix="₼" />
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-black/45">
          <span>
            cəmi depozit{" "}
            <span className="font-medium text-black/70">
              {formatAzn(totalDepositsAzn)}
            </span>
          </span>
          {totalLoansAzn > 0 ? (
            <span>
              · cəmi kredit{" "}
              <span className="font-medium text-status-late">
                {formatAzn(totalLoansAzn)}
              </span>
            </span>
          ) : null}
          <span>
            · likvidlik nisbəti{" "}
            <span className="font-medium text-black/70">
              {liquidityPctLabel}
            </span>
          </span>
        </div>

        <div className="space-y-1.5 pt-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-black/6">
            <div
              className="h-full rounded-l-full bg-status-late/70 transition-all"
              style={{ width: `${loanShareOfDepositsPct}%` }}
            />
          </div>
          <div className="flex gap-4 text-[11px] font-medium text-black/45">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-status-late/70" />
              Kredit
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-black/12" />
              Azad likvidlik
            </span>
          </div>
        </div>

        {totalPendingBonusAzn > 0 ? (
          <div className="space-y-1 pt-1 text-xs leading-5 text-black/45">
            <p>
              Depozitlər üzrə cəmi faiz qazancı:{" "}
              <span className="font-semibold text-ink">
                {formatAzn(totalPendingBonusAzn)}
              </span>
              . Bu məbləğ müvafiq müddətlərin sonunda depozitorlara ödəniləcək.
            </p>
            {totalAccruedInterestAzn > 0 || totalMonthlyInterestAzn > 0 ? (
              <p>
                Bu günə artıq aylıq qazanılıb:{" "}
                <span className="font-semibold text-brand-green-deep">
                  {formatAzn(totalAccruedInterestAzn)}
                </span>
                {totalMonthlyInterestAzn > 0 ? (
                  <>
                    {" "}· cari aylıq qazanc:{" "}
                    <span className="font-semibold text-ink">
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

      {/* 30-day depositor payouts (interest out) */}
      <ListSection
        title="30 gün ərzində ödəniləcək faiz"
        subtitle="Müddəti yaxınlaşan depozitlərə görə bankın çıxış axını"
        headerRight={
          <span className="text-sm font-semibold tabular-nums text-status-late">
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
            <span className="text-sm font-semibold tabular-nums text-black/35">
              —
            </span>
          ) : next30dInflow.totalAzn > 0 ? (
            <span className="text-sm font-semibold tabular-nums text-brand-green-deep">
              +{formatAzn(next30dInflow.totalAzn)}
            </span>
          ) : (
            <span className="text-sm font-semibold tabular-nums text-black/45">
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
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45">
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
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45">
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
