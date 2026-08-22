import { unstable_cache } from "next/cache";
import {
  getDailyCloses,
  getExtendedQuotes,
  getIntradaySpark,
} from "@/lib/yahoo";

// The dashboard's Yahoo-style ticker strip: a fixed basket of world
// benchmarks shown next to the fund's own unit price. Brent is the oil
// quote — Azeri Light prices against it.

/** One dated close of the panel history: ISO day + closing price. */
export type HistoryPoint = { t: string; c: number };

export type TickerQuote = {
  key: string;
  label: string;
  /** Last traded price, USD. */
  price: number;
  /**
   * Fraction vs the previous close, e.g. -0.0017 for −0.17%; null when
   * Yahoo omits the previous close.
   */
  changePct: number | null;
  /** The latest session's intraday closes, for the tile sparkline. */
  spark: number[];
  // NOTE: the 5-year dated history deliberately does NOT ride this payload.
  // Six instruments × ~420 points ≈ 80KB of RSC on every dashboard render;
  // the panel fetches /api/ticker-history on first expand instead.
};

// Daily closes move once a day; cache the 5-year series long (6h) and let
// the 60s ticker cache read it cheaply. The last year keeps EVERY daily
// close (up to 380 — BTC trades all 365 days) so the 6 AY and 1 İL slices
// show real day-to-day texture; older history thins to ~200 points. Closes
// round to 2dp — the series rides the page payload, and long floats double
// its JSON weight for nothing.
const getCached5y = unstable_cache(
  async (symbol: string): Promise<HistoryPoint[]> => {
    try {
      const closes = await getDailyCloses(symbol, 5 * 365 + 30);
      if (closes.length < 2) return [];
      const last = closes[closes.length - 1];
      const cutoffMs =
        new Date(`${last.t}T00:00:00Z`).getTime() - 365 * 86_400_000;
      const cutoff = new Date(cutoffMs).toISOString().slice(0, 10);
      const older = closes.filter((c) => c.t < cutoff);
      const recent = closes.filter((c) => c.t >= cutoff);
      const strideOld = Math.max(1, Math.ceil(older.length / 200));
      const strideNew = Math.max(1, Math.ceil(recent.length / 380));
      const out: HistoryPoint[] = [
        ...older.filter((_, i) => i % strideOld === 0),
        ...recent.filter((_, i) => i % strideNew === 0),
      ].map((c) => ({ t: c.t, c: Math.round(c.close * 100) / 100 }));
      if (out[out.length - 1]?.t !== last.t) {
        out.push({ t: last.t, c: Math.round(last.close * 100) / 100 });
      }
      return out;
    } catch (err) {
      console.error(`[market-ticker] 5y closes failed for ${symbol}:`, err);
      return [];
    }
  },
  // Fresh key per shape/density change so stale entries never mix in.
  ["market-ticker-5y-daily"],
  { revalidate: 21600 },
);

const INSTRUMENTS = [
  { key: "sp500", label: "S&P 500", symbol: "^GSPC" },
  { key: "nasdaq", label: "Nasdaq 100", symbol: "^NDX" },
  { key: "btc", label: "Bitcoin", symbol: "BTC-USD" },
  { key: "gold", label: "Qızıl", symbol: "GC=F" },
  { key: "silver", label: "Gümüş", symbol: "SI=F" },
  { key: "oil", label: "Neft", symbol: "BZ=F" },
] as const;

// One shared 60s cache of the basket — public market data, same for every
// viewer (same recipe as the extended-portfolio quote cache).
const getCachedTicker = unstable_cache(
  async (): Promise<TickerQuote[]> => {
    // Quotes and intraday sparks in one parallel pass; a failed series is
    // just an empty line, never a missing tile.
    const [quotes, sparks] = await Promise.all([
      getExtendedQuotes(INSTRUMENTS.map((i) => i.symbol)),
      Promise.all(INSTRUMENTS.map((i) => getIntradaySpark(i.symbol))),
    ]);
    const out: TickerQuote[] = [];
    INSTRUMENTS.forEach((inst, i) => {
      const q = quotes.get(inst.symbol);
      const price = q?.regularMarketPrice;
      if (price == null || price <= 0) return;
      const prev = q?.regularMarketPreviousClose;
      out.push({
        key: inst.key,
        label: inst.label,
        price,
        changePct: prev != null && prev > 0 ? price / prev - 1 : null,
        spark: sparks[i] ?? [],
      });
    });
    return out;
  },
  // v4: 5y histories moved to the on-demand /api/ticker-history route.
  ["market-ticker-quotes-v4"],
  { revalidate: 60 },
);

/**
 * The panel's 5-year dated history for one instrument key, served by
 * /api/ticker-history when a tile expands. Unknown keys yield [].
 */
export async function getTickerHistory(key: string): Promise<HistoryPoint[]> {
  const inst = INSTRUMENTS.find((i) => i.key === key);
  if (!inst) return [];
  try {
    return await getCached5y(inst.symbol);
  } catch (err) {
    console.error(`[market-ticker] history failed for ${key}:`, err);
    return [];
  }
}

/**
 * Quotes for the ticker strip. Instruments Yahoo fails to return are simply
 * absent, and a hung or failed fetch yields an empty list so the dashboard
 * render never stalls on it — the İRF tile comes from the sheet either way.
 */
export async function getMarketTicker(): Promise<TickerQuote[]> {
  try {
    return await Promise.race([
      getCachedTicker(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("yahoo ticker timeout")), 4000),
      ),
    ]);
  } catch (err) {
    console.error("[market-ticker] quote fetch failed:", err);
    return [];
  }
}
