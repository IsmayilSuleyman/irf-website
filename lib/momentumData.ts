import { unstable_cache } from "next/cache";
import type { Holding } from "@/lib/sheets";
import { getDailyCloses, isTickerSymbol, type DailyClose } from "@/lib/yahoo";
import type { MomentumItem } from "@/lib/momentum";

// Server side of the momentum board: SPY reference returns (for the relative
// strength factor and the alpha pill) plus the Holding → MomentumItem
// mapping. The per-ticker reference prices themselves come from the
// Watchlist's R..U columns, so SPY is the only extra market fetch.

export type SpyReferences = {
  ret4w: number | null;
  ret13w: number | null;
  retYtd: number | null;
};

const NO_SPY: SpyReferences = { ret4w: null, ret13w: null, retYtd: null };

// One shared cache of SPY's daily closes (public data, same for everyone).
const getCachedSpyCloses = unstable_cache(
  async (): Promise<DailyClose[]> => getDailyCloses("SPY", 380),
  ["momentum-spy-closes"],
  { revalidate: 1800 },
);

const DAY = 86_400_000;

/** First close inside [today−fromDaysAgo, today−toDaysAgo] — the same
 *  window semantics as the Watchlist's R/S reference formulas. */
function firstCloseInWindow(
  closes: DailyClose[],
  fromDaysAgo: number,
  toDaysAgo: number,
  now: number,
): number | null {
  const from = now - fromDaysAgo * DAY;
  const to = now - toDaysAgo * DAY;
  for (const c of closes) {
    const t = Date.parse(c.t);
    if (t >= from && t <= to) return c.close;
  }
  return null;
}

export async function getSpyReferences(): Promise<SpyReferences> {
  try {
    // A hung Yahoo handshake must not stall the dashboard — drop the factor.
    const closes = await Promise.race([
      getCachedSpyCloses(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("SPY history timeout")), 4000),
      ),
    ]);
    if (closes.length === 0) return NO_SPY;
    const current = closes[closes.length - 1].close;
    const now = Date.now();
    const year = new Date().getFullYear();
    const ref4 = firstCloseInWindow(closes, 35, 21, now);
    const ref13 = firstCloseInWindow(closes, 105, 77, now);
    const refYtd =
      closes.find((c) => c.t >= `${year}-01-01` && c.t <= `${year}-01-31`)
        ?.close ?? null;
    const ret = (ref: number | null) =>
      ref != null && ref > 0 ? current / ref - 1 : null;
    return { ret4w: ret(ref4), ret13w: ret(ref13), retYtd: ret(refYtd) };
  } catch (err) {
    console.error("[momentum] SPY reference fetch failed:", err);
    return NO_SPY;
  }
}

/** Non-cash holdings with at least one momentum factor available. */
export function buildMomentumItems(
  holdings: Holding[],
  spy: SpyReferences,
): MomentumItem[] {
  return holdings
    .filter((h) => !h.isCash && h.priceUsd > 0 && isTickerSymbol(h.symbol))
    .map<MomentumItem>((h) => {
      const ret = (ref: number | null) =>
        ref != null && ref > 0 ? h.priceUsd / ref - 1 : null;
      const ret13w = ret(h.ref13wUsd);
      return {
        symbol: (h.symbol || h.name).trim().toUpperCase(),
        name: h.name,
        sector: h.sector,
        valueAzn: h.valueAzn,
        priceUsd: h.priceUsd,
        avg200Usd: h.avg200Usd,
        ret4w: ret(h.ref4wUsd),
        ret13w,
        retYtd: ret(h.refYtdUsd),
        rs: ret13w != null && spy.ret13w != null ? ret13w - spy.ret13w : null,
        above200:
          h.avg200Usd != null && h.avg200Usd > 0
            ? h.priceUsd > h.avg200Usd
            : null,
      };
    })
    .filter(
      (i) =>
        i.ret4w != null ||
        i.ret13w != null ||
        i.retYtd != null ||
        i.above200 != null,
    );
}
