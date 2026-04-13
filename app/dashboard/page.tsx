import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getFundData,
  getHolderByName,
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
import { Header } from "@/components/Header";
import { StatTile } from "@/components/StatTile";
import { PerformanceChart } from "@/components/PerformanceChart";
import { HeroPrice } from "@/components/HeroPrice";
import { PriceBadge } from "@/components/PriceBadge";
import { IndicatorsCard } from "@/components/IndicatorsCard";
import { MotionSection } from "@/components/MotionSection";

export const dynamic = "force-dynamic";

function displayNameOf(meta: Record<string, unknown> | undefined): string | null {
  if (!meta) return null;
  return (
    (meta.full_name as string) ||
    (meta.name as string) ||
    (meta.display_name as string) ||
    null
  );
}

function formatBakuDate(d: Date): string {
  return new Intl.DateTimeFormat("az-AZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Baku",
  }).format(d);
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const name = displayNameOf(user.user_metadata);
  const [holder, fund, priceHistory, transactions] = await Promise.all([
    getHolderByName(name),
    getFundData(),
    getPriceHistory(),
    getTransactions(),
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
      </div>
    </main>
  );
}
