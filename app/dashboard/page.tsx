import { cookies } from "next/headers";
import {
  getAssetTransactions,
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
  buildAssetHolderSummaries,
  buildAssetPositions,
  getAssetRowSparks,
  getAssetQuotes,
  getAssetValueOverlay,
  PURCHASABLE_ASSETS,
} from "@/lib/personalAssets";
import { AssetHoldingsCard } from "@/components/AssetHoldingsCard";
import {
  getPriceHistory,
  computePeriodChanges,
  findLatestPriceBeforeDate,
} from "@/lib/priceHistory";
import { getHolderMarketState } from "@/lib/holdings";
import { parseSheetDateMs } from "@/lib/sheetDates";
import { getMarketQuotes } from "@/lib/market";
import { requireUser } from "@/lib/auth-guard";
import { displayNameOf, formatBakuDate } from "@/lib/user";
import { Header } from "@/components/Header";
// Lazy client wrappers: the recharts-powered cards hydrate from their own
// on-demand chunk instead of riding in the dashboard's first-load JS.
import { PerformanceChart } from "@/components/PerformanceChartLazy";
import { PortfolioPie } from "@/components/PortfolioPieLazy";
import { DebtPanel } from "@/components/DebtPanelLazy";
import { ChartSummary, Greeting, HeroPrice } from "@/components/HeroPrice";
import { MarketTickerStrip } from "@/components/MarketTickerStrip";
import { getMarketTicker } from "@/lib/marketTicker";
import { isTickerSymbol } from "@/lib/yahoo";
import { StrategyStatementCard } from "@/components/StrategyStatementCard";
import { DailyRewardCard } from "@/components/DailyRewardCard";
import { getDailyRewardState } from "@/lib/dailyReward";
import { MotionSection } from "@/components/MotionSection";
import {
  getPurchaseCadence,
  getStrategyStatement,
  getWeeklyBudgetAzn,
  isOwnerEmail,
} from "@/lib/fundSettings";
import { AllocationList } from "@/components/AllocationList";
import { SectorBreakdown } from "@/components/SectorBreakdown";
import { RefreshButton } from "@/components/RefreshButton";
import { FundViewToggle } from "@/components/FundViewToggle";
import { ShareholdersList } from "@/components/ShareholdersList";
import { PrivacyProvider } from "@/components/PrivacyProvider";
import { PrivacyToggle } from "@/components/PrivacyToggle";
import { MarketCountdown } from "@/components/MarketCountdown";
import { AutoRetry } from "@/components/AutoRetry";
import { sectorColor, mixWithWhite } from "@/lib/sectorColors";
import { computeDebtProjections, computeDebtSchedule } from "@/lib/debtSchedule";
import { after } from "next/server";
import { refreshExtendedHours } from "@/lib/watchlistExtended";
import {
  getExtendedHistory,
  getExtendedPortfolio,
  getRegularHistory,
  getRegularPortfolio,
  recordSessionSnapshot,
  type SessionHistoryPoint,
} from "@/lib/extendedPortfolio";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ExtendedHoursBadge } from "@/components/ExtendedHoursBadge";
import { buildMomentumItems, getSpyReferences } from "@/lib/momentumData";
import {
  DEFAULT_WEIGHTS,
  portfolioRet13w,
  scoreUniverse,
} from "@/lib/momentum";
import {
  AlphaCompare,
  HealthGauge,
  PortfolioCarousel,
} from "@/components/PortfolioCarousel";
import {
  currentBakuMonthKey,
  currentBakuWeekStart,
  fetchMomentumWeeks,
  recordMomentumWeek,
  withCurrentWeek,
} from "@/lib/momentumWeekData";
import {
  aggregateMonthlyPeriods,
  buildTicket,
  resolveAdvised,
  type WeekScores,
} from "@/lib/buyTicket";
import { resolveSellSignals } from "@/lib/sellSignals";
import { BuyTicketPodium } from "@/components/BuyTicketPodium";
import { computePolicyReport } from "@/lib/investmentPolicy";
import { getMarketSignals } from "@/lib/marketSignals";
import { InvestmentPolicyCard } from "@/components/InvestmentPolicyCard";
import { MarketSignalsPanel } from "@/components/MarketSignalsPanel";

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
  const [holder, fund, priceHistory, transactions, holdings, strategyStatement, debts, marketState, marketQuotes, spyRefs, weeklyBudgetAzn, purchaseCadence, marketSignals, marketTicker, assetTxs] =
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
      getSpyReferences(),
      getWeeklyBudgetAzn(),
      getPurchaseCadence(),
      getMarketSignals(),
      getMarketTicker(),
      getAssetTransactions(),
    ]);
  const canEditStrategy = isAdmin;

  // Shared by the policy card and the carousel's "Bazar siqnalları" slide.
  const policyReport = computePolicyReport(holdings);

  // Non-cash holdings scored by the momentum engine (Watchlist R..U columns
  // + SPY relative strength). Empty when the sheet lacks the columns.
  const momentumItems = buildMomentumItems(holdings, spyRefs);
  // Default-weights scoring, shared by the holdings drill-down, the pie-slot
  // carousel and the weekly buy ticket.
  const momentumDefault = scoreUniverse(momentumItems, DEFAULT_WEIGHTS);
  const momentumBySymbol = Object.fromEntries(
    momentumDefault.rows.map((r) => [r.symbol, r]),
  );
  const portfolio13w = portfolioRet13w(momentumItems);

  // Whole-portfolio revaluation at Yahoo extended-hours prices (pre-market,
  // after-market, or the overnight gap carrying the after-market close);
  // null only during regular trading hours. Shared 60s quote cache. The
  // Supabase hover-graph reads and the 10-minute snapshot recording chain
  // behind it inside one closure, so the whole strand runs concurrently with
  // the ETF quote fetch kicked off just below — instead of the old serial
  // await staircase. Recording runs in-render (not after()) because the
  // Supabase client may touch the request's cookies, which are off-limits
  // post-response; the RPC buckets to 10 minutes and first-write-wins, so
  // repeated renders cost one cheap no-op insert. Extended windows record
  // the extended %, regular hours record the intraday day-change % for the
  // countdown chart.
  const extendedAndHistory = (async () => {
    const extendedPortfolio = await getExtendedPortfolio(holdings);
    let extendedHistory: SessionHistoryPoint[] = [];
    let regularHistory: SessionHistoryPoint[] = [];
    // Past weeks of momentum scores, for the buy ticket's hysteresis replay.
    let momentumWeeks: WeekScores[] = [];
    const histSupabase = await createSupabaseServerClient();
    if (histSupabase) {
      const regularPortfolio = extendedPortfolio
        ? null
        : await getRegularPortfolio(holdings);
      const record = extendedPortfolio
        ? extendedPortfolio.mode !== "overnight"
          ? recordSessionSnapshot(histSupabase, extendedPortfolio.mode, extendedPortfolio.changePct)
          : Promise.resolve()
        : regularPortfolio
          ? recordSessionSnapshot(histSupabase, "regular", regularPortfolio.changePct)
          : Promise.resolve();
      // The weekly snapshot rides along on the same client: the RPC is
      // admin-gated and first-write-wins, so a non-admin render is a rejected
      // no-op and every later admin render this week is a cheap conflict.
      const recordWeek = recordMomentumWeek(histSupabase, momentumDefault.rows, {
        factorsComplete: spyRefs.ret13w != null,
      });
      [extendedHistory, regularHistory, momentumWeeks] = await Promise.all([
        extendedPortfolio
          ? getExtendedHistory(histSupabase, extendedPortfolio.mode)
          : Promise.resolve([] as SessionHistoryPoint[]),
        getRegularHistory(histSupabase),
        fetchMomentumWeeks(histSupabase),
        record.catch(() => undefined),
        recordWeek.catch(() => undefined),
      ]);
    }
    return { extendedPortfolio, extendedHistory, regularHistory, momentumWeeks };
  })();

  // Personal ETF desk quotes (SPY/IBIT/GLDM/SIVR + ledger symbols) — started
  // here so the Yahoo round-trip overlaps the extended-portfolio/history
  // strand above; awaited further down where the positions are built.
  // getAssetQuotes never rejects ({} on failure), so firing early is safe.
  const assetQuotesPromise = getAssetQuotes([
    ...PURCHASABLE_ASSETS.map((a) => a.symbol),
    ...assetTxs.map((t) => t.symbol),
  ]);

  // Günlük mükafat state for the card under the strategy statement — its own
  // Supabase client so it rides the same concurrency window as the strands
  // above. null (no card) when Supabase or the claims table is unavailable.
  const rewardStatePromise = (async () => {
    const sb = await createSupabaseServerClient();
    if (!sb) return null;
    const state = await getDailyRewardState(sb, user.id);
    return state.available ? state : null;
  })();

  const { extendedPortfolio, extendedHistory, regularHistory, momentumWeeks } =
    await extendedAndHistory;
  const rewardState = await rewardStatePromise;

  // This period's ticket. Sector data rides along for the advised set's
  // diversification cap (sectors are a property of the instrument, so the
  // live map stands in for history too).
  //
  // Weekly: the live board stands in for the current week only until its
  // snapshot lands (stored wins — see withCurrentWeek). Monthly: the fold
  // reads STORED completed months only — the running month changes with every
  // snapshot, and mid-month advice flapping is what the cadence exists to
  // avoid; live scores still order the picks and price the amounts.
  const sectorOf = Object.fromEntries(
    momentumDefault.rows.map((r) => [r.symbol, r.sector]),
  );
  const ticketPeriods =
    purchaseCadence === "monthly"
      ? aggregateMonthlyPeriods(momentumWeeks, currentBakuMonthKey())
      : withCurrentWeek(
          momentumWeeks,
          momentumDefault.rows,
          currentBakuWeekStart(),
        );
  const advice = resolveAdvised(ticketPeriods, {
    cadence: purchaseCadence,
    sectorOf,
  });
  // Sell side: P&L context comes from the sheet's average purchase price
  // (totalPnlUsd is AZN-denominated despite its name — see lib/sheets.ts);
  // keys match the momentum rows' normalized symbols.
  const pnlOf = Object.fromEntries(
    holdings
      .filter((h) => !h.isCash)
      .map((h) => [
        (h.symbol || h.name).trim().toUpperCase(),
        { plPct: h.changePct, plAzn: h.totalPnlUsd },
      ]),
  );
  const sellState = resolveSellSignals(ticketPeriods, momentumDefault.rows, {
    cadence: purchaseCadence,
    pnlOf,
  });
  // Confirmed SAT holdings are barred from this period's buys.
  const ticket = buildTicket(
    momentumDefault.rows,
    weeklyBudgetAzn,
    advice,
    undefined,
    sellState.confirmed,
  );

  const dateLabel = formatBakuDate(new Date());

  if (!holder) {
    // Zero holders can only mean the Sheet fetch itself came back empty
    // (a transient Google API failure on a cold cache) — the fund always
    // has holders. Show a self-healing "loading" state for that case;
    // "Sahiblik tapılmadı" is reserved for a genuinely unlinked account,
    // judged against real sheet data.
    const sheetUnavailable = fund.holders.length === 0;
    return (
      <main className="px-6">
        <Header dateLabel={dateLabel} />
        <div className="mx-auto max-w-5xl py-16 text-center">
          {sheetUnavailable ? (
            <>
              <h2 className="mb-2 text-lg font-semibold text-black dark:text-white/90">
                Məlumatlar yüklənir…
              </h2>
              <p className="text-sm text-black/55 dark:text-white/60">
                Fond məlumatlarına müvəqqəti çatmaq mümkün olmadı. Səhifə bir
                neçə saniyəyə özü yenilənəcək.
              </p>
              <AutoRetry />
            </>
          ) : (
            <>
              <h2 className="mb-2 text-lg font-semibold text-black dark:text-white/90">
                Sahiblik tapılmadı
              </h2>
              <p className="text-sm text-black/55 dark:text-white/60">
                Hesabınız ({user.email}) hələ heç bir sahibə bağlanmayıb.
              </p>
            </>
          )}
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
  // The İRF tile's day change: unit price vs the last recorded price point —
  // the same reference the personal day-change figure uses.
  const unitDayPct =
    previousPricePoint && previousPricePoint.price > 0
      ? fund.unitPrice / previousPricePoint.price - 1
      : null;
  // Unit-price deltas for the chart card's price-mode headline: day vs the
  // last recorded point, and the 3-month move (İsmayıl's pick over an
  // all-time figure) from the same reference computePeriodChanges uses.
  const unitDayChange = previousPricePoint
    ? fund.unitPrice - previousPricePoint.price
    : null;
  const unit3mChange =
    periodChanges.m3.pastPrice != null
      ? fund.unitPrice - periodChanges.m3.pastPrice
      : null;
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

  // The holder's own buys/sells, for the chart's ▲/▼ markers — same name
  // normalization the value history uses.
  const normName = (s: string) =>
    s.trim().toLocaleLowerCase("az-AZ").replace(/\s+/g, " ");
  // Dates are normalized to ISO server-side (day-first sheet formats
  // included); a row whose date can't be read gets no marker rather than a
  // guessed position.
  const chartEvents = mergedTransactions
    .filter((t) => normName(t.holderName) === normName(holder.name))
    .flatMap((t) => {
      const ms = parseSheetDateMs(t.date);
      return ms == null
        ? []
        : [{ date: new Date(ms).toISOString(), units: t.units }];
    });

  // A holder with an ETF ledger but no İRF transactions still deserves the
  // Tarixçə series: with no İRF points to ride on, the NAV-recording dates
  // serve as the date grid and the İRF slice is simply zero. (A holder WITH
  // İRF transactions gets the grid from computeHolderValueHistory, which
  // emits zero-unit points too.)
  const holderHasAssetRows = assetTxs.some(
    (t) => normName(t.holderName) === normName(holder.name),
  );
  const chartGrid =
    chartData.length === 0 && holderHasAssetRows
      ? priceHistory.map((p) => ({
          label: p.label,
          value: 0,
          invested: 0,
          date: p.recordedAt,
        }))
      : chartData;

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

  // The extended-hours ₼ delta is fund-wide; in the personal view it scales
  // to the viewer's slice (their units / total units) so a 2-pay holder sees
  // their own few manats, not the whole fund's swing. The % stays fund-wide —
  // every pay moves by the same percentage.
  const holderShare = fund.totalUnits > 0 ? effectiveUnits / fund.totalUnits : 0;
  const badgePortfolio = extendedPortfolio
    ? fundView
      ? extendedPortfolio
      : { ...extendedPortfolio, deltaAzn: extendedPortfolio.deltaAzn * holderShare }
    : null;
  // Fund-wide hero figures, computed on the same basis as the "Ümumi dəyəri"
  // tile below so the headline and the tile always agree.
  const totalCostBasis = holdings.reduce((s, h) => s + h.costBasisAzn, 0);
  const fundTotalChange = fund.totalCapital - totalCostBasis;
  const hasFundDayData = holdings.some((h) => h.dayChangeUsd != null);
  const fundDayChange = hasFundDayData
    ? holdings.reduce((s, h) => s + (h.dayChangeUsd ?? 0), 0)
    : null;

  // Personal ETF desk: the viewer's positions from the Aktivlər ledger,
  // valued at live ETF quotes (SPY/IBIT/GLDM/SIVR — what holders actually
  // buy, unlike the tiles' headline indices), plus per-tile info for the
  // strip's expandable panels. The quote fetch has been in flight since
  // before the history await above.
  const assetQuotes = await assetQuotesPromise;
  const assetPositions = buildAssetPositions(holder.name, assetTxs, assetQuotes);
  // One parallel round for the remaining history series: the Aktivlərim row
  // sparklines (six months of daily closes per held ETF), the fund view's
  // per-holding Fond Portfeli sparklines, and the chart card's ETF value
  // overlay — previously three serial awaits.
  const [assetRowSparks, fondSparks, assetOverlay] = await Promise.all([
    getAssetRowSparks(assetPositions.map((p) => p.symbol)),
    // Fond Portfeli row sparklines — fund view only, one cached series per
    // non-cash holding.
    fundView && holdings.length > 0
      ? getAssetRowSparks(
          holdings
            .filter((h) => !h.isCash && isTickerSymbol(h.symbol))
            .map((h) => h.symbol),
        )
      : Promise.resolve({} as Record<string, number[]>),
    assetPositions.length > 0
      ? getAssetValueOverlay(
          holder.name,
          assetTxs,
          chartGrid.map((p) => p.date.slice(0, 10)),
        )
      : Promise.resolve(null),
  ]);
  const irfRowSpark = priceHistory
    .filter(
      (p) =>
        new Date(p.recordedAt).getTime() >= Date.now() - 186 * 86_400_000,
    )
    .map((p) => p.price);
  // Fund view: every holder's ETF book for the Digər Aktivlər Sahibləri
  // card (separate from Pay sahibləri — these sit outside the fund).
  const assetHolders = fundView
    ? buildAssetHolderSummaries(assetTxs, assetQuotes)
    : [];
  const positionBySymbol = Object.fromEntries(
    assetPositions.map((p) => [p.symbol, p]),
  );
  const tileAssets = Object.fromEntries(
    PURCHASABLE_ASSETS.map((a) => {
      const q = assetQuotes[a.symbol];
      const pos = positionBySymbol[a.symbol];
      return [
        a.key,
        {
          symbol: a.symbol,
          priceUsd: q?.priceUsd ?? null,
          dayChangePct:
            q?.priceUsd != null && q?.prevCloseUsd != null && q.prevCloseUsd > 0
              ? q.priceUsd / q.prevCloseUsd - 1
              : null,
          units: pos?.units ?? 0,
          valueAzn: pos?.valueAzn ?? null,
        },
      ];
    }),
  );

  // The combined personal book for the Tarixçə card: İRF holding plus the
  // ETF positions, and the chart series with the ETF book's value added at
  // each plotted date — so the headline, the plotted line and Aktivlərim's
  // total always describe the same number. With no ETF rows everything
  // degrades to the plain İRF figures.
  const etfValueNow = assetPositions.reduce((s, p) => s + (p.valueAzn ?? 0), 0);
  const etfDayAzn = assetPositions.reduce(
    (s, p) => s + (p.dayChangeAzn ?? 0),
    0,
  );
  const etfPnlAzn = assetPositions.reduce(
    (s, p) => s + (p.totalPnlAzn ?? 0),
    0,
  );
  const mergedBook = assetOverlay
    ? chartGrid.map((p) => {
        const o = assetOverlay[p.date.slice(0, 10)];
        return o
          ? {
              ...p,
              value: p.value + o.valueAzn,
              invested: Math.max(0, p.invested + o.investedAzn),
              // The ETF book's own slice at this date — decomposed in the
              // chart tooltip's İRF / Digər aktivlər rows.
              other: o.valueAzn,
            }
          : { ...p, other: 0 };
      })
    : chartGrid;
  // Zero-value edges say nothing: leading zeros are days before the book
  // existed, trailing zeros a fully-exited one. Interior zeros stay — a real
  // "worth nothing" stretch between an İRF exit and the first ETF buy.
  let bookStart = 0;
  let bookEnd = mergedBook.length;
  while (bookStart < bookEnd && mergedBook[bookStart].value <= 0) bookStart += 1;
  while (bookEnd > bookStart && mergedBook[bookEnd - 1].value <= 0) bookEnd -= 1;
  const bookChartData =
    bookStart > 0 || bookEnd < mergedBook.length
      ? mergedBook.slice(bookStart, bookEnd)
      : mergedBook;
  const bookValue = holdingValue + etfValueNow;
  const bookDayChange =
    dayChange != null || assetPositions.some((p) => p.dayChangeAzn != null)
      ? (dayChange ?? 0) + etfDayAzn
      : null;
  const bookPnl =
    holdingPnl != null || assetPositions.some((p) => p.totalPnlAzn != null)
      ? (holdingPnl ?? 0) + etfPnlAzn
      : null;

  // The chart headline's right-edge cluster: the extended-hours badge (when
  // a session is live) next to the hide-amounts eye. Personal view only —
  // the fund view keeps both in its own rows.
  const chartActions = (
    <div className="flex items-center gap-2">
      {badgePortfolio && (
        <ExtendedHoursBadge
          data={badgePortfolio}
          scope="personal"
          history={extendedHistory}
          align="right"
        />
      )}
      <PrivacyToggle />
    </div>
  );

  return (
    <main className="px-6 pb-24">
      <Header dateLabel={dateLabel} />

      <PrivacyProvider initialHidden={amountsHidden}>
      <div className="mx-auto -mt-6 flex max-w-5xl flex-col gap-16 sm:mt-0">
        {/* Hero — greeting with the view controls inline on its own line
            (every breakpoint), then the Yahoo-style ticker card:
            market-status chips on top, benchmark tiles + İRF unit price
            below. The hide-amounts eye lives beside the chart card's
            headline in the personal view; the fund view (no chart card)
            keeps it here. */}
        <MotionSection id="icmal" className="scroll-mt-36 flex flex-col gap-5">
          <Greeting
            holderName={holder.name}
            privacyToggle={fundView ? <PrivacyToggle /> : undefined}
            toggle={
              <>
                <span className="sm:hidden">
                  <FundViewToggle active={fundView} compact />
                </span>
                <span className="hidden sm:inline-flex">
                  <FundViewToggle active={fundView} />
                </span>
              </>
            }
          />
          {fundView ? null : ( /* Ümumfond baxış skips the ticker card; its
               status chips sit under the fund figure instead. */
            <MarketTickerStrip
              quotes={marketTicker}
              irf={{
                priceAzn: fund.unitPrice,
                changePct: unitDayPct,
                // Unit-price history stands in for an intraday line — the
                // pay reprices daily, so its "movement" is the last stretch
                // of recorded prices.
                spark: priceChartData.slice(-30).map((p) => p.value),
              }}
              assets={tileAssets}
              showBuyHint={!isAdmin}
              statusRow={
                <div className="flex flex-wrap items-center gap-2">
                  <MarketCountdown history={regularHistory} />
                </div>
              }
            />
          )}
        </MotionSection>

        {/* Personal view: the holding value lives inside the history chart
            card (Yahoo's portfolio-performance composition), with the
            buy/sell quotes in a compact row under it. Fund view keeps the
            plain fund hero next to the shareholders list — its dedicated
            "Ümumfond dəyər tarixçəsi" chart comes later. */}
        {/* Fund view, one desktop row: the fund figure in a narrow left
            column (its font sized down to fit), the two holder cards side
            by side on the right. Mobile stacks: figure, then the cards. */}
        {fundView ? (
          <MotionSection delay={0.05} className="-mt-11 grid grid-cols-1 gap-x-8 gap-y-6 lg:grid-cols-3 lg:items-start">
            <div className="flex flex-col gap-5 lg:col-span-2">
              <HeroPrice
                variant="fund"
                showGreeting={false}
                holderName={holder.name}
                value={fund.totalCapital}
                dayChange={fundDayChange}
                totalChange={fundTotalChange}
              />
              {/* Market status + extended-hours badge, below the figure —
                  this view has no ticker card or chart card to carry them.
                  compact: the narrow column can't fit the full wording even
                  on desktop. */}
              <div className="flex flex-wrap items-center gap-2">
                <MarketCountdown history={regularHistory} compact />
                {badgePortfolio && (
                  <ExtendedHoursBadge
                    data={badgePortfolio}
                    scope="fund"
                    history={extendedHistory}
                  />
                )}
              </div>
            </div>
            <div className="lg:col-span-1">
              <ShareholdersList
                holders={fund.holders}
                assetHolders={assetHolders}
              />
            </div>
          </MotionSection>
        ) : (
          <>
            <MotionSection id="tarixce" delay={0.05} className="scroll-mt-32 -mt-11">
              <PerformanceChart
                data={bookChartData}
                priceData={priceChartData}
                events={chartEvents}
                hero={
                  <ChartSummary
                    value={bookValue}
                    dayChange={bookDayChange}
                    totalChange={bookPnl}
                    units={effectiveUnits}
                    avgBuyPrice={perf.avgBuyPrice}
                    action={chartActions}
                  />
                }
                priceHero={
                  <ChartSummary
                    masked={false}
                    value={fund.unitPrice}
                    dayChange={unitDayChange}
                    totalChange={unit3mChange}
                    totalLabel="son 3 ayda"
                    units={effectiveUnits}
                    avgBuyPrice={perf.avgBuyPrice}
                    action={chartActions}
                  />
                }
              />
            </MotionSection>
            {/* Aktivlərim — the viewer's whole personal book: İRF pays
                first, then ETF positions from the Aktivlər ledger. Sits
                right under the chart card (the unit-price row is gone —
                Alış/Satış live on /market). */}
            {(assetPositions.length > 0 || effectiveUnits > 0) && (
              <MotionSection
                id="aktivlerim"
                delay={0.08}
                className="scroll-mt-32 -mt-11"
              >
                <AssetHoldingsCard
                  positions={assetPositions}
                  irf={
                    effectiveUnits > 0
                      ? {
                          units: effectiveUnits,
                          avgBuyAzn: perf.avgBuyPrice,
                          priceAzn: fund.unitPrice,
                          valueAzn: holdingValue,
                          dayChangePct: unitDayPct,
                          dayChangeAzn: dayChange,
                          totalPnlAzn: holdingPnl,
                          spark: irfRowSpark,
                        }
                      : null
                  }
                  sparks={assetRowSparks}
                  showBuyHint={!isAdmin}
                />
              </MotionSection>
            )}
          </>
        )}

        {/* Strategy statement — personal view only. The günlük mükafat card
            docks to its bottom (İsmayıl's placement call); with no statement
            to show, the reward card stands alone in the same slot. */}
        {!fundView &&
        (canEditStrategy || strategyStatement.trim().length > 0 || rewardState) ? (
          <MotionSection delay={0.12} className="-mt-10">
            {canEditStrategy || strategyStatement.trim().length > 0 ? (
              <StrategyStatementCard
                initialValue={strategyStatement}
                canEdit={canEditStrategy}
              />
            ) : null}
            {rewardState ? (
              <div
                className={
                  canEditStrategy || strategyStatement.trim().length > 0
                    ? "mt-4"
                    : undefined
                }
              >
                <DailyRewardCard state={rewardState} />
              </div>
            ) : null}
          </MotionSection>
        ) : null}

        {/* Debt panel — admin only, personal view only */}
        {!fundView && isAdmin && debts.length > 0 && (
          <MotionSection id="borclar" delay={0.13} className="scroll-mt-32 hairline -mt-8 pt-6">
            <DebtPanel
              projections={computeDebtProjections(debts)}
              schedule={computeDebtSchedule(debts)}
            />
          </MotionSection>
        )}

        {/* Fond portfeli — fund view only (İsmayıl's call: the personal view
            stays a personal statement; everything fund-wide lives under
            Ümumfond baxış). */}
        {fundView && holdings.length > 0 && (() => {
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
            sector: holding.sector ?? "Naməlum",
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
                  <div className="text-[11px] uppercase tracking-[0.16em] text-brand-green/80 sm:text-[14px] sm:tracking-[0.22em]">
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
                          sector: holding.sector ?? "Naməlum",
                          sharesHeld: holding.sharesHeld,
                          priceUsd: holding.priceUsd,
                          avgPurchaseUsd: holding.avgPurchaseUsd,
                          valueAzn: holding.valueAzn,
                          percent: holding.percent,
                          changePct: holding.changePct,
                          dayChangePct: holding.dayChangePct,
                          dayChangeAzn: holding.dayChangeUsd,
                          totalPnlAzn: holding.totalPnlUsd,
                          isCash: holding.isCash,
                          color,
                        }))}
                      extended={
                        extendedPortfolio
                          ? {
                              mode: extendedPortfolio.mode,
                              quotes: extendedPortfolio.perSymbol,
                            }
                          : null
                      }
                      momentum={
                        momentumDefault.rows.length > 0
                          ? momentumBySymbol
                          : undefined
                      }
                      sparks={fondSparks}
                    />
                  </div>
                  <div className="lg:col-span-1 flex flex-col gap-6">
                    {/* Pie slot carousel: sector pie ⟷ health gauge ⟷ vs SPY. */}
                    <PortfolioCarousel
                      slides={[
                        {
                          key: "pie",
                          label: "Sektor dairəsi",
                          content: (
                            <PortfolioPie
                              sectors={sectorSlices}
                              stocks={stockSlices}
                            />
                          ),
                        },
                        ...(momentumDefault.health != null
                          ? [
                              {
                                key: "health",
                                label: "Portfelin momentum gücü",
                                content: (
                                  <HealthGauge
                                    health={momentumDefault.health}
                                  />
                                ),
                              },
                            ]
                          : []),
                        ...(portfolio13w != null && spyRefs.ret13w != null
                          ? [
                              {
                                key: "alpha",
                                label: "S&P 500 ilə müqayisə (13 həftə)",
                                content: (
                                  <AlphaCompare
                                    portfolioRet={portfolio13w}
                                    spyRet={spyRefs.ret13w}
                                  />
                                ),
                              },
                            ]
                          : []),
                        {
                          key: "signals",
                          label: "Bazar siqnalları",
                          content: (
                            <MarketSignalsPanel
                              report={policyReport}
                              signals={marketSignals}
                            />
                          ),
                        },
                      ]}
                    />
                    <SectorBreakdown rows={sectorRows} />
                  </div>
                </div>
              </div>
            </MotionSection>
          );
        })()}

        {/* İnvestisiya siyasəti — sleeve allocation vs the written policy,
            unwind schedule and the dip-buying trigger. Fund view, with the
            rest of the fund-wide sections. */}
        {fundView && holdings.length > 0 && (
          <MotionSection
            id="siyaset"
            delay={0.16}
            className="scroll-mt-32 hairline -mt-8 pt-6"
          >
            <InvestmentPolicyCard
              report={policyReport}
              signals={marketSignals}
            />
          </MotionSection>
        )}

        {/* Həftəlik alış bileti — fund view only */}
        {fundView && ticket.picks.length > 0 && (
          <MotionSection
            id="bilet"
            delay={0.17}
            className="scroll-mt-32 hairline -mt-8 pt-6"
          >
            <div className="glass p-6">
              <BuyTicketPodium ticket={ticket} sell={sellState} canEdit={isAdmin} />
            </div>
          </MotionSection>
        )}
      </div>
      </PrivacyProvider>
    </main>
  );
}
