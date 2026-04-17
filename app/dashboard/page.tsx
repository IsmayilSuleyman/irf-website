import {
  getFundData,
  getHolderByName,
  getHoldings,
  getTransactions,
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
import { PortfolioPie } from "@/components/PortfolioPie";
import { SectorBreakdown } from "@/components/SectorBreakdown";
import { sectorColor, mixWithWhite } from "@/lib/sectorColors";

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
        {holdings.length > 0 && (() => {
          // Group by sector, sort sectors by total value desc, stocks within
          // each sector by value desc. This ordering is shared by the pie
          // (so stocks sit inside their sector wedge), the list, and the
          // sector breakdown — colors line up across all three.
          const groups = new Map<string, typeof holdings>();
          for (const h of holdings) {
            const key = h.sector ?? "Naməlum";
            const arr = groups.get(key);
            if (arr) arr.push(h);
            else groups.set(key, [h]);
          }
          const sectorEntries = Array.from(groups.entries())
            .map(([sector, hs]) => {
              const sorted = [...hs].sort(
                (a, b) => b.valueAzn - a.valueAzn,
              );
              const total = sorted.reduce((s, h) => s + h.valueAzn, 0);
              return { sector, holdings: sorted, total };
            })
            .sort((a, b) => b.total - a.total);

          const portfolioTotal = sectorEntries.reduce(
            (s, e) => s + e.total,
            0,
          );

          const colored: Array<{
            holding: (typeof holdings)[number];
            color: string;
          }> = [];
          for (const { sector, holdings: hs } of sectorEntries) {
            const base = sectorColor(sector);
            hs.forEach((h, idx) => {
              const shade = mixWithWhite(base, Math.min(idx * 0.14, 0.55));
              colored.push({ holding: h, color: shade });
            });
          }

          const stockSlices = colored.map(({ holding, color }) => ({
            name: holding.name,
            value: holding.valueAzn,
            fill: color,
          }));
          const sectorSlices = sectorEntries.map((e) => ({
            name: e.sector,
            value: e.total,
            fill: sectorColor(e.sector),
          }));
          // Sectors that should always appear in the breakdown even when
          // the fund currently holds nothing in them.
          const ALWAYS_SHOW_SECTORS = [
            "Səhiyyə",
            "Zəruri İstehlak",
            "Q.Zəruri İstehlak",
            "Enerji",
          ];
          const presentSectors = new Set(sectorEntries.map((e) => e.sector));
          const emptySectorRows = ALWAYS_SHOW_SECTORS.filter(
            (s) => !presentSectors.has(s),
          ).map((sector) => ({
            sector,
            valueAzn: 0,
            percent: 0,
            color: sectorColor(sector),
          }));
          const sectorRows = [
            ...sectorEntries.map((e) => ({
              sector: e.sector,
              valueAzn: e.total,
              percent: portfolioTotal > 0 ? e.total / portfolioTotal : 0,
              color: sectorColor(e.sector),
            })),
            ...emptySectorRows,
          ];

          return (
            <MotionSection delay={0.15} className="hairline pt-10">
              <div className="glass p-6 flex flex-col gap-6">
                <div className="text-[10px] uppercase tracking-[0.22em] text-brand-green/80">
                  Fond Portfeli
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  <div className="lg:col-span-2">
                    <AllocationList
                      items={colored.map(({ holding, color }) => ({
                        name: holding.name,
                        priceUsd: holding.priceUsd,
                        valueAzn: holding.valueAzn,
                        percent: holding.percent,
                        changePct: holding.changePct,
                        isCash: holding.isCash,
                        color,
                      }))}
                    />
                  </div>
                  <div className="lg:col-span-1 flex flex-col gap-6">
                    <PortfolioPie
                      sectors={sectorSlices}
                      stocks={stockSlices}
                    />
                    <SectorBreakdown rows={sectorRows} />
                  </div>
                </div>
              </div>
            </MotionSection>
          );
        })()}
      </div>
    </main>
  );
}
