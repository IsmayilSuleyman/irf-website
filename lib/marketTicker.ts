import { unstable_cache } from "next/cache";
import { getExtendedQuotes } from "@/lib/yahoo";

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
};

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
    const quotes = await getExtendedQuotes(INSTRUMENTS.map((i) => i.symbol));
    const out: TickerQuote[] = [];
    for (const inst of INSTRUMENTS) {
      const q = quotes.get(inst.symbol);
      const price = q?.regularMarketPrice;
      if (price == null || price <= 0) continue;
      const prev = q?.regularMarketPreviousClose;
      out.push({
        key: inst.key,
        label: inst.label,
        price,
        changePct: prev != null && prev > 0 ? price / prev - 1 : null,
      });
    }
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
