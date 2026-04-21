import {
  getFundData,
  getHolderByName,
  getTransactions,
  getHoldings,
  computeHolderPerformance,
  computeHolderValueHistory,
  computeHoldingDeltaSince,
} from "@/lib/sheets";
import {
  getPriceHistory,
  computePeriodChanges,
  findLatestPriceBeforeDate,
} from "@/lib/priceHistory";
import { formatAzn } from "@/lib/portfolio";
import { requireUser } from "@/lib/auth-guard";
import { displayNameOf, formatBakuDate } from "@/lib/user";
import { Header } from "@/components/Header";
import { StatTile } from "@/components/StatTile";
import { PerformanceChart } from "@/components/PerformanceChart";
import { HeroPrice } from "@/components/HeroPrice";
import { PriceBadge } from "@/components/PriceBadge";
import { IndicatorsCard } from "@/components/IndicatorsCard";
import { MotionSection } from "@/components/MotionSection";
import { AllocationList } from "@/components/AllocationList";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();

  const name = displayNameOf(user.user_metadata);
  const [holder, fund, priceHistory, transactions, holdings] = await Promise.all([
    getHolderByName(name),
    getFundData(),
    getPriceHistory(),
    getTransactions(),
    getHoldings(),
  ]);

  const dateLabel = formatBakuDate(new Date());

  if (!holder) {
    return (
      <main className="px-6">
        <Header dateLabel={dateLabel} />
        <div className="mx-auto max-w-5xl py-16 text-center">
          <h2 className="mb-2 text-lg font-semibold text-black">
            Sahiblik tapılmadı
          </h2>
          <p className="text-sm text-black/55">
            Hesabınız ({user.email}) hələ heç bir sahibə bağlanmayıb.
          </p>
        </div>
      </main>
    );
  }

  const perf = computeHolderPerformance(
    holder.name,
    transactions,
    fund.unitPrice,
    holder.units,
  );
  const periodChanges = computePeriodChanges(fund.unitPrice, priceHistory);
  const previousPricePoint = findLatestPriceBeforeDate(priceHistory, new Date());
  const holdingValue = fund.unitPrice * holder.units;
  const holdingPnl =
    perf.avgBuyPrice != null ? perf.pnlAzn : null;
  const dayChange = previousPricePoint
    ? computeHoldingDeltaSince(
        holder.name,
        transactions,
        holder.units,
        fund.unitPrice,
        previousPricePoint.price,
        new Date(previousPricePoint.recordedAt),
      )
    : null;

  // Per-user holding value over time: units_held_at_T × unit_price_at_T
  const chartData = computeHolderValueHistory(
    holder.name,
    transactions,
    priceHistory,
  );

  return (
    <main className="px-6 pb-24">
      <Header dateLabel={dateLabel} />

      <div className="mx-auto flex max-w-5xl flex-col gap-16">
        {/* Hero */}
        <MotionSection className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-end">
          <div className="lg:col-span-2">
            <HeroPrice
              holderName={holder.name}
              holdingValue={holdingValue}
              holdingPnl={holdingPnl}
              dayChange={dayChange}
              units={holder.units}
              avgBuyPrice={perf.avgBuyPrice}
            />
          </div>
          <div className="lg:col-span-1">
            <PriceBadge current={fund.unitPrice} />
          </div>
        </MotionSection>

        {/* Chart */}
        <MotionSection delay={0.05}>
          <PerformanceChart data={chartData} />
        </MotionSection>

        {/* Fund info */}
        <MotionSection delay={0.1} className="hairline pt-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatTile
              label="Ümumi dəyəri"
              value={formatAzn(fund.totalCapital)}
            />
            <StatTile
              label="Xalis dəyəri"
              value={formatAzn(fund.netCapital)}
              sub="Bütün borclar çıxılandan sonrakı nəticə."
            />
            <IndicatorsCard changes={periodChanges} />
          </div>
        </MotionSection>

        {/* Fond portfeli */}
        {holdings.length > 0 && (
          <MotionSection delay={0.15} className="hairline pt-10">
            <div className="glass p-6 flex flex-col gap-6">
              <div className="text-[10px] uppercase tracking-[0.22em] text-brand-green/80">
                Fond Portfeli
              </div>
              <AllocationList
                items={holdings.map((h) => ({
                  name: h.name,
                  valueAzn: h.valueAzn,
                  percent: h.percent,
                  priceUsd: h.priceUsd,
                  dailyPriceChangeUsd: h.dailyPriceChangeUsd,
                  dailyChangePct: h.dailyChangePct,
                  shares: h.shares,
                  avgBuyPriceUsd: h.avgBuyPriceUsd,
                  dayValueChangeUsd: h.dayValueChangeUsd,
                  overallChangePct: h.overallChangePct,
                  totalProfitLossUsd: h.totalProfitLossUsd,
                }))}
              />
            </div>
          </MotionSection>
        )}
      </div>
    </main>
  );
}
