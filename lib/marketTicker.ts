import { unstable_cache } from "next/cache";
import {
  getDailyCloses,
  getExtendedQuotes,
  getIntradaySpark,
} from "@/lib/yahoo";

// The dashboard's Yahoo-style ticker strip: a fixed basket of world
// benchmarks shown next to the fund's own unit price. Brent is the oil
// quote — Azeri Light prices against it.

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
  /** Five years of daily closes, downsampled — the tile panel's history chart. */
  history5y: number[];
};

// Daily closes move once a day; cache the 5-year series long (6h) and let
// the 60s ticker cache read it cheaply. Downsampled to ≤120 points — plenty
// for a panel-height curve — always keeping the true last close.
const getCached5y = unstable_cache(
  async (symbol: string): Promise<number[]> => {
    try {
      const closes = await getDailyCloses(symbol, 5 * 365 + 30);
      const values = closes.map((c) => c.close);
      if (values.length < 2) return [];
      const stride = Math.max(1, Math.ceil(values.length / 120));
      const out = values.filter((_, i) => i % stride === 0);
      if (out[out.length - 1] !== values[values.length - 1]) {
        out.push(values[values.length - 1]);
      }
      return out;
    } catch (err) {
      console.error(`[market-ticker] 5y closes failed for ${symbol}:`, err);
      return [];
    }
  },
  ["market-ticker-5y"],
  { revalidate: 21600 },
);

const INSTRUMENTS = [
  { key: "sp500", label: "S&P 500", symbol: "^GSPC" },
  { key: "btc", label: "Bitcoin", symbol: "BTC-USD" },
  { key: "gold", label: "Qızıl", symbol: "GC=F" },
  { key: "silver", label: "Gümüş", symbol: "SI=F" },
  { key: "oil", label: "Neft", symbol: "BZ=F" },
] as const;

// One shared 60s cache of the basket — public market data, same for every
// viewer (same recipe as the extended-portfolio quote cache).
const getCachedTicker = unstable_cache(
  async (): Promise<TickerQuote[]> => {
    // Quotes, intraday sparks and 5y histories in one parallel pass; a
    // failed series is just an empty line, never a missing tile.
    const [quotes, sparks, histories] = await Promise.all([
      getExtendedQuotes(INSTRUMENTS.map((i) => i.symbol)),
      Promise.all(INSTRUMENTS.map((i) => getIntradaySpark(i.symbol))),
      Promise.all(INSTRUMENTS.map((i) => getCached5y(i.symbol))),
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
        history5y: histories[i] ?? [],
      });
    });
    return out;
  },
  ["market-ticker-quotes"],
  { revalidate: 60 },
);

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
