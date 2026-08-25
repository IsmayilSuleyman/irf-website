import { formatAzn } from "@/lib/portfolio";

// The bank's money in two mirrored columns that sum to the SAME total —
// where it comes from (Mənbələr) and where it sits (Yerləşdirmə). The
// floating stat tiles above answer "how much"; this answers "so what does
// the bank actually do with my money" in one glance.

type Row = {
  label: string;
  hint: string;
  amountAzn: number;
  bar: string; // fill class
};

function Column({
  title,
  rows,
  totalAzn,
}: {
  title: string;
  rows: Row[];
  totalAzn: number;
}) {
  // A NEGATIVE row (free liquidity when loans exceed funding) must stay
  // visible in rose — hiding it would make the columns lie.
  const visible = rows.filter((r) => Math.abs(r.amountAzn) > 0.005);
  return (
    <div className="rounded-hero border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/10">
      <header className="px-5 py-4 sm:px-6">
        <h3 className="text-[15px] font-semibold tracking-[-0.02em] text-ink dark:text-white/90">
          {title}
        </h3>
      </header>
      <div className="divide-y divide-black/5 dark:divide-white/5 border-t border-black/10 dark:border-white/10">
        {visible.map((r) => (
          <div key={r.label} className="px-5 py-3 sm:px-6">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-sm font-medium text-ink dark:text-white/90">{r.label}</p>
              <p
                className={`num shrink-0 text-sm font-semibold tabular-nums ${
                  r.amountAzn < 0
                    ? "text-status-late dark:text-rose-400"
                    : "text-ink dark:text-white/90"
                }`}
              >
                {formatAzn(r.amountAzn)}
              </p>
            </div>
            <p className="mt-0.5 text-[11px] text-black/45 dark:text-white/50">{r.hint}</p>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10" aria-hidden>
              <div
                className={`h-full rounded-full ${r.bar}`}
                style={{
                  width: `${totalAzn > 0 ? Math.min((Math.max(r.amountAzn, 0) / totalAzn) * 100, 100) : 0}%`,
                }}
              />
            </div>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-4 px-5 py-3.5 sm:px-6">
          <p className="text-sm font-semibold text-ink dark:text-white/90">Cəmi</p>
          <p className="num shrink-0 text-sm font-bold tabular-nums text-ink dark:text-white/90">
            {formatAzn(totalAzn)}
          </p>
        </div>
      </div>
    </div>
  );
}

export function BankBalanceSheet({
  depositsAzn,
  bondFundingAzn,
  assetReserveAzn,
  loansAzn,
  netLiquidityAzn,
}: {
  depositsAzn: number;
  bondFundingAzn: number;
  assetReserveAzn: number;
  loansAzn: number;
  netLiquidityAzn: number;
}) {
  // Both columns close on the same figure by construction:
  // deposits + bonds + reserve  ≡  loans + (deposits + bonds − loans) + reserve.
  const totalAzn = depositsAzn + bondFundingAzn + assetReserveAzn;

  const sources: Row[] = [
    {
      label: "Depozitlər",
      hint: "iştirakçıların bankdakı əmanətləri",
      amountAzn: depositsAzn,
      bar: "bg-bank-blue",
    },
    {
      label: "İstiqraz vəsaiti",
      hint: "istiqraz satışından cəlb olunan vəsait",
      amountAzn: bondFundingAzn,
      bar: "bg-bank-blue/60",
    },
    {
      label: "Aktivlər ehtiyatı",
      hint: "ETF alışlarını təmin edən vəsait",
      amountAzn: assetReserveAzn,
      bar: "bg-bank-blue/35",
    },
  ];

  const uses: Row[] = [
    {
      label: "Verilmiş kreditlər",
      hint: "borc alanlara verilib, cədvəl üzrə qayıdır",
      amountAzn: loansAzn,
      bar: "bg-status-late/70",
    },
    {
      label: "Azad likvidlik",
      hint: "istənilən an ödənişə hazır sərbəst pul",
      amountAzn: netLiquidityAzn,
      bar: "bg-brand-green",
    },
    {
      label: "Toxunulmaz ehtiyat",
      hint: "aktivlər ehtiyatının qarşılığı — kreditə verilmir",
      amountAzn: assetReserveAzn,
      bar: "bg-bank-blue/35",
    },
  ];

  return (
    <section id="balans" className="scroll-mt-6">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/50">
            Balans
          </p>
          <h2 className="mt-1 text-[15px] font-semibold tracking-[-0.02em] text-ink dark:text-white/90">
            Pul haradan gəlir, harada dayanır
          </h2>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <Column title="Mənbələr" rows={sources} totalAzn={totalAzn} />
        <Column title="Yerləşdirmə" rows={uses} totalAzn={totalAzn} />
      </div>
    </section>
  );
}
