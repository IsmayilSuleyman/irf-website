import { unstable_cache } from "next/cache";
import { USD_TO_AZN, type Holding } from "@/lib/sheets";
import {
  getExtendedQuotes,
  isTickerSymbol,
  toYahooSymbol,
  type ExtendedQuote,
} from "@/lib/yahoo";

// Portfolio revalued at Yahoo's pre/after-market prices, for the dashboard
// badge next to the market countdown. Three windows:
//   pre       — the pre-market session is running (04:00–09:30 ET);
//   post      — the after-market session is running (16:00–20:00 ET);
//   overnight — everything in between (20:00–04:00 ET and weekends): the
//               last extended print is the after-market close, so the badge
//               carries that move until pre-market takes over.
// Only regular trading hours show nothing — the day change covers those.

export type ExtendedMode = "pre" | "post" | "overnight";

export type ExtendedPortfolio = {
  mode: ExtendedMode;
  /** Fraction, e.g. 0.0103 for +1.03% vs the regular-session value. */
  changePct: number;
  /** AZN difference of the whole stock portfolio at extended prices. */
  deltaAzn: number;
  /** How many holdings actually had an extended-hours price. */
  coveredCount: number;
  totalCount: number;
};

/**
 * Pure math: revalue the stock holdings (shares from the Sheet) at extended
 * prices. Positions without an extended quote are carried at their regular
 * price, so they dilute the percentage instead of vanishing from the base.
 * `expected` comes from the wall clock; for pre/post the quotes' majority
 * market state must agree (guards a stale cache at session boundaries).
 * Overnight there is no live session to agree with — the after-market close
 * fields simply persist in the quotes — so no state check applies.
 * Exported for tests.
 */
export function computeExtendedPortfolio(
  holdings: Holding[],
  quotes: ExtendedQuote[],
  expected: ExtendedMode,
): ExtendedPortfolio | null {
  const stocks = holdings.filter(
    (h) => !h.isCash && h.sharesHeld > 0 && isTickerSymbol(h.symbol),
  );
  if (stocks.length === 0) return null;

  const bySymbol = new Map(quotes.map((q) => [q.symbol, q]));

  if (expected !== "overnight") {
    let preCount = 0;
    let postCount = 0;
    for (const q of quotes) {
      if (q.marketState === "PRE") preCount += 1;
      else if (q.marketState === "POST") postCount += 1;
    }
    const half = Math.max(1, Math.ceil(quotes.length / 2));
    const majority: "pre" | "post" | null =
      preCount >= half ? "pre" : postCount >= half ? "post" : null;
    if (majority !== expected) return null;
  }

  // Overnight the freshest extended print is the after-market close.
  const useField = expected === "pre" ? "preMarketPrice" : "postMarketPrice";

  let valueReg = 0;
  let valueExt = 0;
  let coveredCount = 0;
  for (const h of stocks) {
    const q = bySymbol.get(toYahooSymbol(h.symbol));
    const reg = q?.regularMarketPrice ?? h.priceUsd;
    if (!Number.isFinite(reg) || reg <= 0) continue;
    const ext = q?.[useField];
    valueReg += h.sharesHeld * reg;
    valueExt += h.sharesHeld * (ext ?? reg);
    if (ext != null) coveredCount += 1;
  }
  if (coveredCount === 0 || valueReg <= 0) return null;

  return {
    mode: expected,
    changePct: valueExt / valueReg - 1,
    deltaAzn: (valueExt - valueReg) * USD_TO_AZN,
    coveredCount,
    totalCount: stocks.length,
  };
}

// One shared 60s cache of the quote batch (public market data, same for
// every viewer). Maps don't survive the cache serialization, hence arrays.
const getCachedQuotes = unstable_cache(
  async (symbols: string[]): Promise<ExtendedQuote[]> => {
    const map = await getExtendedQuotes(symbols);
    return [...map.values()];
  },
  ["extended-portfolio-quotes"],
  { revalidate: 60 },
);

/**
 * The extended window the New York clock says we're in right now — the badge
 * fetches/renders in all of them and hides only during regular trading
 * hours (the day change covers those). For pre/post the quotes' majority
 * state must additionally agree, guarding against stale-while-revalidate
 * serving a morning PRE snapshot during POST.
 */
export function currentUsSession(now = new Date()): ExtendedMode | null {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = get("weekday");
  if (weekday === "Sat" || weekday === "Sun") return "overnight";
  const mins = (Number(get("hour")) % 24) * 60 + Number(get("minute"));
  if (mins >= 4 * 60 && mins < 9 * 60 + 30) return "pre"; // 04:00–09:30 ET
  if (mins >= 9 * 60 + 30 && mins < 16 * 60) return null; // regular session
  if (mins >= 16 * 60 && mins < 20 * 60) return "post"; // 16:00–20:00 ET
  return "overnight"; // 20:00–04:00 ET
}

/** Badge data for the dashboard; null only during regular trading hours. */
export async function getExtendedPortfolio(
  holdings: Holding[],
): Promise<ExtendedPortfolio | null> {
  // No fetch during the regular session — the badge never renders then.
  const expected = currentUsSession();
  if (!expected) return null;

  const symbols = [
    ...new Set(
      holdings
        .filter((h) => !h.isCash && h.sharesHeld > 0 && isTickerSymbol(h.symbol))
        .map((h) => toYahooSymbol(h.symbol)),
    ),
  ].sort();
  if (symbols.length === 0) return null;

  try {
    // A hung Yahoo handshake must not stall the dashboard render — give up
    // after a few seconds and drop the badge for this request.
    const quotes = await Promise.race([
      getCachedQuotes(symbols),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("yahoo quote timeout")), 4000),
      ),
    ]);
    return computeExtendedPortfolio(holdings, quotes, expected);
  } catch (err) {
    console.error("[extended-portfolio] quote fetch failed:", err);
    return null;
  }
}
