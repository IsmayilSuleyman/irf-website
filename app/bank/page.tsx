import Link from "next/link";
import {
  computeBankWide,
  getBankAccountByName,
  getBankAccounts,
  monthlyDepositInterestAzn,
  type BankAccount,
} from "@/lib/bank";
import { getFundData } from "@/lib/sheets";
import { getHolderMarketState } from "@/lib/holdings";
import { requireUser } from "@/lib/auth-guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { displayNameOf, formatBakuDate } from "@/lib/user";
import { getBankProductTerms } from "@/lib/bankTerms";
import {
  getBondFundingAzn,
  getBondFundingBreakdown,
  getMyBondHoldings,
} from "@/lib/bonds";
import { computeLiquidityProjection } from "@/lib/liquidityProjection";
import { getAssetTransactions } from "@/lib/sheets";
import {
  PURCHASABLE_ASSETS,
  buildAssetPositions,
  computeAssetReserveAzn,
  getAssetQuotes,
} from "@/lib/personalAssets";
import { BankAssetsVault, type VaultInvite } from "@/components/BankAssetsVault";
import { MotionSection } from "@/components/MotionSection";
import { BankHeader } from "@/components/BankHeader";
import { BankViewToggle } from "@/components/BankViewToggle";
import { BankWideView } from "@/components/BankWideView";
import { BankTermsPanel } from "@/components/BankTermsPanel";
import { BalanceHero } from "@/components/BalanceHero";
import { CreditPanel } from "@/components/CreditPanel";
import { DailyRewardAdminCard } from "@/components/DailyRewardAdminCard";
import {
  getDailyRewardState,
  getDailyRewardTotals,
  type DailyRewardHolderTotal,
} from "@/lib/dailyReward";
import { CreditOfferBanner } from "@/components/CreditOfferBanner";
import { CreditOfferPanel } from "@/components/CreditOfferPanel";
import {
  getAllCreditOffers,
  getMyCreditOffer,
  normalizeHolderName,
  offerAmountAzn,
} from "@/lib/creditOffers";
import { DebtNoticePanel } from "@/components/DebtNoticePanel";
import { BroadcastPanel } from "@/components/BroadcastPanel";

export const dynamic = "force-dynamic";

// Bank-app style quick actions: the bank's products/venues one tap away.
// Positioned right under the welcome line so primary navigation no longer
// hides at the bottom of the page. "Balansım" / "Kreditlərim" jump to the
// matching sections further down; the credit card only shows when the account
// actually has that product, while the balance card is always present because
// the balance hero always renders.
function QuickActions({
  hasDeposit,
  hasBonds,
  hasCredit,
  hasAssets,
}: {
  hasDeposit: boolean;
  hasBonds: boolean;
  hasCredit: boolean;
  hasAssets: boolean;
}) {
  // The balance hero always renders now, so its anchor is always a valid
  // target — the card follows the hero's own label rule.
  const depositOnly = hasDeposit && !hasBonds;
  const actions = [
    {
      href: "#depozitlerim",
      label: depositOnly ? "Depozitlərim" : "Balansım",
      desc: depositOnly
        ? "Depozit balansım və şərtləri"
        : "Depozit və istiqraz balansım",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="12" cy="12" r="3.5" />
          <path d="M12 10.2v1.8l1.2 1.2" />
        </svg>
      ),
    },
    ...(hasCredit
      ? [
          {
            href: "#kreditlerim",
            label: "Kreditlərim",
            desc: "Kredit qalığı və ödəniş cədvəli",
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M3 10h18" />
                <path d="M7 15h4" />
              </svg>
            ),
          },
        ]
      : []),
    {
      href: "/bonds",
      label: "İstiqrazlar",
      desc: "Kupon istiqrazları al və sat",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 7h8M8 11h8M8 15h4" />
          <circle cx="16" cy="16.5" r="1.6" />
        </svg>
      ),
    },
    {
      href: "/market",
      label: "Bazar",
      desc: "Fond paylarının alqı-satqısı",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 4v16m0-16L3 8m4-4 4 4" />
          <path d="M17 20V4m0 16 4-4m-4 4-4-4" />
        </svg>
      ),
    },
    {
      href: "/ismayilbank",
      label: "Kalkulyator",
      desc: "Kredit və depozit şərtləri",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M9 7h6M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01" />
        </svg>
      ),
    },
    // The vault: gold/silver/BTC/S&P bought through İsmayıl — stored at the
    // bank but never part of the deposit balance.
    ...(hasAssets
      ? [
          {
            href: "#aktivlerim",
            label: "Aktivlərim",
            desc: "Seyf: İRF payı, qızıl, BTC, S&P",
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <circle cx="11" cy="12" r="3.2" />
                <path d="M11 10.4v1.6l1 1M17.5 8.5v7" />
              </svg>
            ),
          },
        ]
      : []),
  ];

  // Flex-wrap instead of a fixed grid so 3, 4 or 5 cards all fill the row.
  // Compact rows (tinted icon square + label/desc beside it) instead of the
  // old tall icon-on-top tiles — half the height, two per row on phones.
  return (
    <div className="mt-6 flex flex-wrap gap-2.5">
      {actions.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className="group flex min-w-[9rem] flex-1 basis-[calc(50%-0.625rem)] items-center gap-3 rounded-card border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/10 px-3.5 py-3 transition hover:-translate-y-0.5 hover:border-bank-blue/30 hover:shadow-sm sm:basis-0"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-bank-blue-soft dark:bg-bank-blue/15 text-bank-blue dark:text-blue-400">
            {a.icon}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold tracking-[-0.01em] text-ink dark:text-white/90">
              {a.label}
            </span>
            <span className="hidden truncate text-[11px] text-black/45 dark:text-white/50 lg:block">
              {a.desc}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}

export default async function BankPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireUser("/bank");
  const sp = await searchParams;
  // Bank-wide transparency view, available to every signed-in user. Encoded in
  // the URL (?view=bank) so the server renders the right dataset and the state
  // survives refreshes — mirrors FundViewToggle on /dashboard.
  const bankView = sp?.view === "bank";
  const dateLabel = formatBakuDate(new Date());

  if (bankView) {
    const [accounts, bondFundingAzn, bondBreakdown, assetTxs] =
      await Promise.all([
        getBankAccounts(),
        getBondFundingAzn(),
        getBondFundingBreakdown(),
        getAssetTransactions(),
      ]);
    const aggregate = computeBankWide(
      accounts,
      new Date(),
      bondFundingAzn,
      // ETF paid-basis reserve — displayed as its own untouchable line,
      // never part of lendable funding.
      computeAssetReserveAzn(assetTxs),
    );
    const projection = computeLiquidityProjection(
      accounts,
      bondBreakdown,
      aggregate.netLiquidityAzn,
      new Date(),
    );
    return (
      <main className="min-h-screen bg-bank-section">
        <BankHeader dateLabel={dateLabel} />
        <section className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
          <div className="hidden justify-end sm:-mb-6 sm:flex">
            <BankViewToggle active={bankView} />
          </div>
          <MotionSection>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-bank-blue dark:text-blue-400">
                ÜMUMBANK BAXIŞI
              </p>
              <BankViewToggle active={bankView} compact className="sm:hidden" />
            </div>
          </MotionSection>
          <MotionSection delay={0.04}>
            <BankWideView aggregate={aggregate} projection={projection} />
          </MotionSection>
        </section>
      </main>
    );
  }

  const name = displayNameOf(user.user_metadata);
  const [sheetAccount, bonds, creditOffer, allAssetTxs, fund, marketState] =
    await Promise.all([
      getBankAccountByName(name),
      getMyBondHoldings(),
      getMyCreditOffer(name),
      getAssetTransactions(),
      // İRF joins the vault podium (with its own not-a-deposit note); a
      // sheet outage just leaves it off, never breaks the bank page.
      getFundData().catch(() => null),
      getHolderMarketState(name).catch(() => null),
    ]);
  const irfValueAzn =
    fund && marketState ? fund.unitPrice * marketState.effectiveUnits : 0;

  // The vault: the holder's ETF book (gold/silver/BTC/S&P bought through
  // İsmayıl), valued live. Deliberately NEVER added to the deposit figure —
  // these sit in the bank's safe, outside the balance and outside lendable
  // funding.
  const myAssetSymbols = name
    ? [
        ...new Set(
          allAssetTxs
            .filter(
              (t) =>
                normalizeHolderName(t.holderName) === normalizeHolderName(name),
            )
            .map((t) => t.symbol),
        ),
      ]
    : [];
  // Quotes cover the WHOLE purchasable set, not just held symbols: unowned
  // assets appear on the podium as invitations with their live prices.
  const assetQuotes = await getAssetQuotes([
    ...new Set([...PURCHASABLE_ASSETS.map((a) => a.symbol), ...myAssetSymbols]),
  ]);
  const assetPositions = name
    ? buildAssetPositions(name, allAssetTxs, assetQuotes)
    : [];
  const ownedSymbols = new Set(assetPositions.map((p) => p.symbol));
  const unownedAssets: VaultInvite[] = PURCHASABLE_ASSETS.filter(
    (a) => !ownedSymbols.has(a.symbol),
  ).map((a) => {
    const q = assetQuotes[a.symbol];
    return {
      symbol: a.symbol,
      label: a.label,
      iconKey: a.key,
      dayChangePct:
        q?.priceUsd != null && q?.prevCloseUsd != null && q.prevCloseUsd > 0
          ? q.priceUsd / q.prevCloseUsd - 1
          : null,
    };
  });

  // Bonds are bought on /bonds without any bank-sheet row, so a bondholder can
  // legitimately have no row at all. Fall back to a zero-deposit account for
  // them — otherwise their balance would sit behind the "hesab tapılmadı"
  // screen below and they'd have no way to see what they hold.
  const account: BankAccount | undefined =
    sheetAccount ??
    (bonds.totalUnits > 0
      ? {
          annualRatePct: null,
          depositedAzn: 0,
          maturityBonusAzn: null,
          maturityDate: null,
          monthlyPaymentAzn: null,
          name: name ?? "",
          netAzn: 0,
          nextPaymentDate: null,
          outstandingLoanAzn: 0,
          paymentSchedule: [],
          termMonths: null,
          updatedAt: null,
        }
      : undefined);

  // Admin (is_fund_admin) can push on-demand "pay your debt" notices to borrowers.
  const supabase = await createSupabaseServerClient();
  const isAdmin = supabase
    ? (await supabase.rpc("is_fund_admin")).data === true
    : false;
  // Günlük mükafat: today's claim state for the card, and (admin only) the
  // per-holder settlement totals. Both degrade to "no card" when the
  // migration hasn't been applied yet.
  const [rewardState, rewardTotals] = supabase
    ? await Promise.all([
        getDailyRewardState(supabase, user.id),
        isAdmin
          ? getDailyRewardTotals(supabase)
          : Promise.resolve([] as DailyRewardHolderTotal[]),
      ])
    : [null, [] as DailyRewardHolderTotal[]];

  const adminAccounts = isAdmin ? await getBankAccounts() : [];
  const debtors = adminAccounts
    .filter((a) => a.outstandingLoanAzn > 0)
    .map((a) => ({ name: a.name, amount: a.outstandingLoanAzn }));
  const recipientNames = adminAccounts.map((a) => a.name);

  // The credit-offer banner: only for accounts with no active loan. The loan
  // check runs against the FULL account list and FAILS CLOSED — a Sheets
  // outage returns [] and would otherwise make every borrower look loan-free
  // (the personal `account` can also be the zero-loan bond fallback). A
  // percent offer resolves against live net liquidity; the product terms
  // supply the "faiz X%-dən başlayır" teaser. All 60s-cached fetches.
  let offerEligible = false;
  let offerAzn = 0;
  let offerMinRatePct: number | null = null;
  if (creditOffer != null) {
    const allAccounts = await getBankAccounts();
    const myRow = name
      ? allAccounts.find(
          (a) => normalizeHolderName(a.name) === normalizeHolderName(name),
        )
      : undefined;
    offerEligible =
      allAccounts.length > 0 && (myRow?.outstandingLoanAzn ?? 0) <= 0;
    if (offerEligible) {
      if (creditOffer.mode === "pct") {
        const bondFunding = await getBondFundingAzn();
        const deposits = allAccounts.reduce((s, a) => s + a.depositedAzn, 0);
        const loans = allAccounts.reduce((s, a) => s + a.outstandingLoanAzn, 0);
        offerAzn = offerAmountAzn(creditOffer, deposits + bondFunding - loans);
      } else {
        offerAzn = offerAmountAzn(creditOffer, 0);
      }
      if (offerAzn > 0) {
        const terms = await getBankProductTerms();
        const rates = terms.credit.map((t) => t.annualRatePct).filter((r) => r > 0);
        offerMinRatePct = rates.length > 0 ? Math.min(...rates) : null;
      }
    }
  }

  const productTerms = isAdmin ? await getBankProductTerms() : null;
  // Cabinet data: every offer with today's resolved amounts, plus the lowest
  // credit rate for the banner preview's teaser.
  const adminOffers = isAdmin ? await getAllCreditOffers() : [];
  const adminNetLiquidity = isAdmin
    ? adminAccounts.reduce((s, a) => s + a.depositedAzn - a.outstandingLoanAzn, 0) +
      (await getBondFundingAzn())
    : 0;
  const adminMinRatePct = (() => {
    if (!productTerms) return null;
    const rates = productTerms.credit
      .map((t) => t.annualRatePct)
      .filter((r) => r > 0);
    return rates.length > 0 ? Math.min(...rates) : null;
  })();

  if (!account) {
    return (
      <main className="min-h-screen bg-bank-section">
        <BankHeader dateLabel={dateLabel} />
        <div className="mx-auto flex max-w-5xl justify-end px-6 pt-6">
          <BankViewToggle active={bankView} />
        </div>
        <section className="mx-auto max-w-[680px] px-5 py-20 text-center sm:py-28">
          <MotionSection>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-green dark:text-emerald-400">
              Hesab tapılmadı
            </p>
            <h1 className="mt-4 text-[clamp(1.9rem,3vw,2.5rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-ink dark:text-white/90">
              Bu giriş hələ bank cədvəlinə bağlanmayıb
            </h1>
            <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-black/55 dark:text-white/60">
              {user.email} hesabı üçün uyğun bank sətri tapılmadı.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
              <Link
                href="/portal"
                className="inline-flex items-center justify-center rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-white/10 px-5 py-3 text-sm font-medium text-black/70 dark:text-white/75 transition hover:border-bank-blue/30 hover:text-bank-blue dark:hover:text-blue-400"
              >
                Portala qayıt
              </Link>
              <Link
                href="/ismayilbank"
                className="inline-flex items-center justify-center rounded-xl bg-bank-blue px-5 py-3 text-sm font-medium text-white transition hover:bg-bank-blue-deep"
              >
                Kalkulyatora keç
              </Link>
            </div>
          </MotionSection>
        </section>
      </main>
    );
  }

  // Unsettled daily rewards are money too — an account holding only rewards
  // is not "empty".
  const rewardAzn = rewardState?.available ? rewardState.unsettledAzn : 0;
  const hasNoProducts =
    account.depositedAzn <= 0 &&
    rewardAzn <= 0 &&
    account.outstandingLoanAzn <= 0 &&
    bonds.totalUnits <= 0 &&
    account.paymentSchedule.length === 0;

  return (
    <main className="min-h-screen bg-bank-section">
      <BankHeader dateLabel={dateLabel} />

      <section className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
        <MotionSection>
          {/* The toggle lives inside the greeting row (not a negative-margin
              overlay) so it can never collide with the quick-actions cards. */}
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-bank-blue dark:text-blue-400">
              XOŞ GƏLDİN, {account.name}
            </p>
            <BankViewToggle active={bankView} compact className="sm:hidden" />
            <BankViewToggle active={bankView} className="hidden sm:inline-flex" />
          </div>
        </MotionSection>

        {/* ── Personal credit offer — set per account in İsmayıl's cabinet.
            FIRST content block, straight after the greeting: for the loan-free
            accounts it targets, the offer is the page's main news, and the
            bank "speaks" in order — xoş gəldin → sizin üçün təklifimiz var →
            budur hesabınız. With no offer the layout is untouched. ── */}
        {offerEligible && offerAzn > 0 ? (
          <MotionSection delay={0.02}>
            <div className="mt-6">
              <CreditOfferBanner
                amountAzn={offerAzn}
                minRatePct={offerMinRatePct}
              />
            </div>
          </MotionSection>
        ) : null}

        <MotionSection delay={offerEligible && offerAzn > 0 ? 0.03 : 0.02}>
          <QuickActions
            hasDeposit={account.depositedAzn > 0}
            hasBonds={bonds.totalUnits > 0}
            hasCredit={account.outstandingLoanAzn > 0 || account.paymentSchedule.length > 0}
            hasAssets
          />
        </MotionSection>


        {/* ── Balance Section — Fund-hero style headline ──
            Total on top, deposit + bonds as its two legs underneath. Renders
            for every account, including one holding nothing: a plain 0,00 ₼ is
            an answer to "what do I have here", where an absent hero is not. */}
        <MotionSection delay={0.04}>
          <div id="depozitlerim" className="mt-8 scroll-mt-6">
            <BalanceHero
              depositedAzn={account.depositedAzn}
              rewardAzn={rewardAzn}
              termMonths={account.termMonths}
              annualRatePct={account.annualRatePct}
              maturityBonusAzn={account.maturityBonusAzn}
              maturityDate={account.maturityDate}
              depositMonthlyAzn={monthlyDepositInterestAzn(account)}
              bondValueAzn={bonds.nominalValueAzn}
              bondUnits={bonds.totalUnits}
              bondIssues={bonds.holdings.length}
              bondMonthlyAzn={bonds.monthlyCouponAzn}
            />
          </div>
        </MotionSection>

        {/* ── The vault: other assets, stored at the bank but OUTSIDE the
            balance above — the card itself says so. ── */}
        {/* Always renders: unowned assets show as podium invitations, so
            even an empty vault advertises what can be bought. */}
        <MotionSection delay={0.05}>
          <div id="aktivlerim" className="mt-8 scroll-mt-6">
            <BankAssetsVault
              positions={assetPositions}
              unowned={unownedAssets}
              irfValueAzn={irfValueAzn}
            />
          </div>
        </MotionSection>

        {/* ── Empty state — sits under the 0,00 ₼ hero and explains it ── */}
        {hasNoProducts ? (
          <MotionSection delay={0.06}>
            <div className="mt-10 flex flex-col items-start">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/50">
                Hələlik heç nə yoxdur
              </p>
              <p className="mt-3 max-w-sm text-sm leading-6 text-black/55 dark:text-white/60">
                Depozit və ya kredit məhsullarımızla tanış olmaq üçün kalkulyatora keç.
              </p>
              <Link
                href="/ismayilbank"
                className="mt-6 inline-flex items-center justify-center rounded-xl bg-bank-blue px-5 py-3 text-sm font-medium text-white transition hover:bg-bank-blue-deep"
              >
                Depozit və kredit şərtlərinə bax
              </Link>
            </div>
          </MotionSection>
        ) : null}

        {/* ── Credits Section — one card telling the whole story: remaining
            debt hero, highlighted next payment with countdown, per-payment
            progress segments and the schedule as a status-dot timeline. ── */}
        {account.outstandingLoanAzn > 0 ||
        account.paymentSchedule.length > 0 ? (
          <MotionSection delay={0.08}>
            <div id="kreditlerim" className="mt-10 scroll-mt-6">
              <CreditPanel
                outstandingAzn={account.outstandingLoanAzn}
                monthlyPaymentAzn={account.monthlyPaymentAzn}
                schedule={account.paymentSchedule}
              />
            </div>
          </MotionSection>
        ) : null}

        {isAdmin ? (
          <MotionSection delay={0.16}>
            <div className="mt-12">
              <div className="flex items-center gap-3">
                <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink dark:text-white/90">
                  İdarəetmə
                </h2>
                <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <DebtNoticePanel debtors={debtors} />
                <BroadcastPanel recipients={recipientNames} />
                {rewardTotals.length > 0 ? (
                  <DailyRewardAdminCard totals={rewardTotals} />
                ) : null}
              </div>
              <div className="mt-4">
                <CreditOfferPanel
                  accountNames={recipientNames}
                  loanHolders={debtors.map((d) => d.name)}
                  offers={adminOffers}
                  netLiquidityAzn={adminNetLiquidity}
                  minRatePct={adminMinRatePct}
                />
              </div>
              {productTerms ? (
                <div className="mt-4">
                  <BankTermsPanel initial={productTerms} />
                </div>
              ) : null}
            </div>
          </MotionSection>
        ) : null}
      </section>
    </main>
  );
}
