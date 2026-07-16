import Link from "next/link";
import { cookies } from "next/headers";
import {
  getFundData,
  getHolderByName,
  getHoldings,
  getTransactions,
  getDebts,
  computeHolderPerformance,
  computeHolderValueHistory,
  computeHoldingDeltaSince,
} from "@/lib/sheets";
import {
  getPriceHistory,
  computePeriodChanges,
  findLatestPriceBeforeDate,
} from "@/lib/priceHistory";
import { getHolderMarketState } from "@/lib/holdings";
import { getMarketQuotes } from "@/lib/market";
import { bestQuotes, buyPrice, sellPrice } from "@/lib/priceMath";
import { requireUser } from "@/lib/auth-guard";
import { displayNameOf, formatBakuDate } from "@/lib/user";
import { Header } from "@/components/Header";
import { PerformanceChart } from "@/components/PerformanceChart";
import { HeroPrice } from "@/components/HeroPrice";
import { PriceBadge } from "@/components/PriceBadge";
import { FundSummary } from "@/components/FundSummary";
import { StrategyStatementCard } from "@/components/StrategyStatementCard";
import { MotionSection } from "@/components/MotionSection";
import { getStrategyStatement, isOwnerEmail } from "@/lib/fundSettings";
import { AllocationList } from "@/components/AllocationList";
import { PortfolioPie } from "@/components/PortfolioPie";
import { SectorBreakdown } from "@/components/SectorBreakdown";
import { RefreshButton } from "@/components/RefreshButton";
import { FundViewToggle } from "@/components/FundViewToggle";
import { ShareholdersList } from "@/components/ShareholdersList";
import { PrivacyProvider } from "@/components/PrivacyProvider";
import { PrivacyToggle } from "@/components/PrivacyToggle";
import { MarketCountdown } from "@/components/MarketCountdown";
import { DebtPanel } from "@/components/DebtPanel";
import { sectorColor, mixWithWhite } from "@/lib/sectorColors";
import { computeDebtProjections, computeDebtSchedule } from "@/lib/debtSchedule";
import { SectionNav } from "@/components/SectionNav";
import { after } from "next/server";
import { refreshExtendedHours } from "@/lib/watchlistExtended";
import { getExtendedPortfolio } from "@/lib/extendedPortfolio";
import { ExtendedHoursBadge } from "@/components/ExtendedHoursBadge";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  // Push Yahoo pre/after-market quotes into the Watchlist tab after the
  // response is sent (throttled inside; a failure never affects the page).
  after(() => refreshExtendedHours().catch(() => undefined));
  // Hide-amounts (eye button) state — read server-side so SSR renders the
  // masked state directly, with no flash of visible amounts on load.
  const amountsHidden =
    (await cookies()).get("irf-hide-amounts")?.value === "1";

  const name = displayNameOf(user.user_metadata);
  const isAdmin = isOwnerEmail(user.email);
  const [holder, fund, priceHistory, transactions, holdings, strategyStatement, debts, marketState, marketQuotes] =
    await Promise.all([
      getHolderByName(name),
      getFundData(),
      getPriceHistory(),
      getTransactions(),
      getHoldings(),
      getStrategyStatement(),
      isAdmin ? getDebts() : Promise.resolve([]),
      getHolderMarketState(name),
      getMarketQuotes(),
    ]);
  const canEditStrategy = isAdmin;

  // Whole-portfolio revaluation at Yahoo extended-hours prices (pre-market,
  // after-market, or the overnight gap carrying the after-market close);
  // null only during regular trading hours. Shared 60s quote cache.
  const extendedPortfolio = await getExtendedPortfolio(holdings);

  const dateLabel = formatBakuDate(new Date());

  if (!holder) {
    return (
      <main className="px-6">
        <Header dateLabel={dateLabel} />
        <div className="mx-auto max-w-5xl py-16 text-center">
          <h2 className="mb-2 text-lg font-semibold text-black dark:text-white/90">
            Sahiblik tapılmadı
          </h2>
          <p className="text-sm text-black/55 dark:text-white/60">
            Hesabınız ({user.email}) hələ heç bir sahibə bağlanmayıb.
          </p>
        </div>
      </main>
    );
  }

  // Live balance = Google Sheet opening units + net settled market trades.
  const effectiveUnits = marketState.effectiveUnits;
  const mergedTransactions = [...transactions, ...marketState.marketTransactions];

  const perf = computeHolderPerformance(
    holder.name,
    mergedTransactions,
    fund.unitPrice,
    effectiveUnits,
  );
  const periodChanges = computePeriodChanges(fund.unitPrice, priceHistory);
  const previousPricePoint = findLatestPriceBeforeDate(priceHistory, new Date());
  const holdingValue = fund.unitPrice * effectiveUnits;
  const holdingPnl =
    perf.avgBuyPrice != null ? perf.pnlAzn : null;
  const dayChange = previousPricePoint
    ? computeHoldingDeltaSince(
        holder.name,
        mergedTransactions,
        effectiveUnits,
        fund.unitPrice,
        previousPricePoint.price,
        new Date(previousPricePoint.recordedAt),
      )
    : null;

  // Per-user holding value over time: units_held_at_T × unit_price_at_T
  const chartData = computeHolderValueHistory(
    holder.name,
    mergedTransactions,
    priceHistory,
  );

  // Unit-price series for the chart's "1 payın qiyməti" mode — same public
  // price every holder sees.
  const priceChartData = priceHistory.map((p) => ({
    label: p.label,
    value: p.price,
    date: p.recordedAt,
  }));

  // Whole-fund view, available to every signed-in holder. The mode is encoded
  // in the URL (?view=fund) so the server renders the correct dataset.
  const fundView = sp?.view === "fund";
  // Fund-wide hero figures, computed on the same basis as the "Ümumi dəyəri"
  // tile below so the headline and the tile always agree.
  const totalCostBasis = holdings.reduce((s, h) => s + h.costBasisAzn, 0);
  const fundTotalChange = fund.totalCapital - totalCostBasis;
  const hasFundDayData = holdings.some((h) => h.dayChangeUsd != null);
  const fundDayChange = hasFundDayData
    ? holdings.reduce((s, h) => s + (h.dayChangeUsd ?? 0), 0)
    : null;

  // Badge prices reflect the live order book (best bid/ask) on top of the Fund
  // quote; fall back to the plain Fund ±commission quote if market data is down.
  const badgeQuotes = marketQuotes
    ? bestQuotes(
        fund.unitPrice,
        marketQuotes.bestBuyOrder,
        marketQuotes.bestSellOrder,
        marketQuotes.fundCanSell,
      )
    : { ask: buyPrice(fund.unitPrice), bid: sellPrice(fund.unitPrice) };

  // Jump-chips for the section nav — only sections actually rendered below.
  const navItems = [
    { id: "icmal", label: "İcmal" },
    ...(!fundView ? [{ id: "tarixce", label: "Tarixçə" }] : []),
    ...(!fundView ? [{ id: "fond", label: "Fond" }] : []),
    ...(!fundView && isAdmin && debts.length > 0
      ? [{ id: "borclar", label: "Borclar" }]
      : []),
    ...(holdings.length > 0 ? [{ id: "portfel", label: "Portfel" }] : []),
  ];

  return (
    <main className="px-6 pb-24">
      <Header dateLabel={dateLabel} />
      {navItems.length > 2 && <SectionNav items={navItems} />}

      <PrivacyProvider initialHidden={amountsHidden}>
      <div className="mx-auto -mt-6 flex max-w-5xl flex-col gap-16 sm:mt-0">
        {/* Desktop top-right controls: hide-amounts eye + fund-view toggle in
            one row (no extra height). On mobile both live in the greeting row. */}
        <div className="hidden items-center justify-end gap-3 sm:-mb-12 sm:flex">
          <PrivacyToggle />
          <FundViewToggle active={fundView} />
        </div>

        {/* Hero */}
        <MotionSection id="icmal" className="scroll-mt-36 grid grid-cols-1 lg:grid-cols-3 gap-x-12 gap-y-6 items-end">
          <div className="lg:col-span-2 flex flex-col gap-5">
            {fundView ? (
              <HeroPrice
                variant="fund"
                holderName={holder.name}
                value={fund.totalCapital}
                dayChange={fundDayChange}
                totalChange={fundTotalChange}
                privacyToggle={<PrivacyToggle className="sm:hidden" />}
                toggle={
                  <FundViewToggle active={fundView} compact className="ml-auto sm:hidden" />
                }
              />
            ) : (
              <HeroPrice
                holderName={holder.name}
                holdingValue={holdingValue}
                holdingPnl={holdingPnl}
                dayChange={dayChange}
                units={effectiveUnits}
                avgBuyPrice={perf.avgBuyPrice}
                privacyToggle={<PrivacyToggle className="sm:hidden" />}
                toggle={
                  <FundViewToggle active={fundView} compact className="ml-auto sm:hidden" />
                }
              />
            )}
            <div className="flex flex-wrap items-center gap-2">
              <MarketCountdown />
              {!fundView && (
                <Link
                  href="/market"
                  className="group inline-flex items-center gap-1.5 rounded-full border border-brand-green/30 bg-brand-green/5 px-3 py-1.5 text-[11px] font-medium text-brand-green dark:text-emerald-400 shadow-sm transition hover:bg-brand-green/10"
                >
                  <span>Bazar</span>
                  <span aria-hidden className="transition group-hover:translate-x-0.5">→</span>
                </Link>
              )}
              {extendedPortfolio && <ExtendedHoursBadge data={extendedPortfolio} />}
            </div>
          </div>
          <div className="lg:col-span-1 flex flex-col gap-3">
            {fundView ? (
              <ShareholdersList holders={fund.holders} />
            ) : (
              <PriceBadge current={fund.unitPrice} ask={badgeQuotes.ask} bid={badgeQuotes.bid} />
            )}
          </div>
        </MotionSection>

        {/* Chart — personal holding history. The whole-fund view will get a
            dedicated "Ümumfond dəyər tarixçəsi" chart later; hidden for now. */}
        {!fundView && (
          <MotionSection id="tarixce" delay={0.05} className="scroll-mt-32 -mt-10">
            <PerformanceChart data={chartData} priceData={priceChartData} />
          </MotionSection>
        )}

        {/* Fund info — hidden in the whole-fund view; the hero already shows the totals. */}
        {!fundView && (
        <MotionSection id="fond" delay={0.1} className="scroll-mt-32 hairline -mt-8 pt-6">
          <FundSummary
            totalCapital={fund.totalCapital}
            totalCostBasis={totalCostBasis}
            netCapital={fund.netCapital}
            changes={periodChanges}
          />
        </MotionSection>
        )}

        {/* Strategy statement — personal view only */}
        {!fundView && (canEditStrategy || strategyStatement.trim().length > 0) && (
          <MotionSection delay={0.12} className="-mt-10">
            <StrategyStatementCard
              initialValue={strategyStatement}
              canEdit={canEditStrategy}
            />
          </MotionSection>
        )}

        {/* Debt panel — admin only, personal view only */}
        {!fundView && isAdmin && debts.length > 0 && (
          <MotionSection id="borclar" delay={0.13} className="scroll-mt-32 hairline -mt-8 pt-6">
            <DebtPanel
              projections={computeDebtProjections(debts)}
              schedule={computeDebtSchedule(debts)}
            />
          </MotionSection>
        )}

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
            <MotionSection id="portfel" delay={0.15} className="scroll-mt-32 hairline -mt-8 pt-6">
              <div className="glass p-6 flex flex-col gap-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-brand-green/80">
                    Fond Portfeli
                  </div>
                  <RefreshButton />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  <div className="lg:col-span-2">
                    <AllocationList
                      items={[...colored]
                        .sort(
                          (a, b) => b.holding.valueAzn - a.holding.valueAzn,
                        )
                        .map(({ holding, color }) => ({
                          symbol: holding.symbol,
                          name: holding.name,
                          priceUsd: holding.priceUsd,
                          valueAzn: holding.valueAzn,
                          percent: holding.percent,
                          changePct: holding.changePct,
                          dayChangePct: holding.dayChangePct,
                          dayChangeAzn: holding.dayChangeUsd,
                          totalPnlAzn: holding.totalPnlUsd,
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
      </PrivacyProvider>
    </main>
  );
}
