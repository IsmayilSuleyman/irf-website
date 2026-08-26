import { unstable_cache } from "next/cache";
import {
  getDailyCloses,
  getExtendedQuotes,
  getIntradaySpark,
  toYahooSymbol,
} from "@/lib/yahoo";
import { getHoldings } from "@/lib/sheets";
import type { ExtendedMode } from "@/lib/marketHours";
import { effectiveSessionMode, sessionPriceOf } from "@/lib/sessionPricing";

// The dashboard's Yahoo-style ticker strip: a fixed basket of world
// benchmarks shown next to the fund's own unit price. Brent is the oil
// quote — Azeri Light prices against it.

/** One dated close of the panel history: ISO day + closing price. */
export type HistoryPoint = { t: string; c: number };

export type TickerQuote = {
  key: string;
  label: string;
  /** Company name (holdings tiles) — shown in the expand panel header. */
  name?: string;
  /** Watchlist sector (holdings tiles) — picks the tile icon. */
  sector?: string | null;
  /** Last traded price, USD. */
  price: number;
  /**
   * Fraction vs the previous close, e.g. -0.0017 for −0.17%; null when
   * Yahoo omits the previous close.
   */
  changePct: number | null;
  /** The latest session's intraday closes, for the tile sparkline. */
  spark: number[];
  /** The extended session baked into price/changePct via an ETF proxy
   *  (SPY/QQQ for the cash indices, which don't trade off-hours) — the
   *  tile shows the session glyph when set. */
  sessionMode?: ExtendedMode | null;
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

// The cash indices freeze outside regular hours (crypto trades 24/7 and the
// futures nearly 24/5) — their tiles ride the pre/post move of the liquid
// ETF twin instead, applied as a percentage on top of the index level.
const EXT_PROXIES: Record<string, string> = {
  "^GSPC": "SPY",
  "^NDX": "QQQ",
};

// One shared 60s cache of the basket — public market data, same for every
// viewer (same recipe as the extended-portfolio quote cache).
const getCachedTicker = unstable_cache(
  async (): Promise<TickerQuote[]> => {
    // Quotes and intraday sparks in one parallel pass; a failed series is
    // just an empty line, never a missing tile.
    const [quotes, sparks] = await Promise.all([
      getExtendedQuotes([
        ...INSTRUMENTS.map((i) => i.symbol),
        ...Object.values(EXT_PROXIES),
      ]),
      Promise.all(INSTRUMENTS.map((i) => getIntradaySpark(i.symbol))),
    ]);
    // The proxies' own marketState decides whether an extended window is
    // actually printing (the same guard the İRF fold uses).
    const proxyQuotes = Object.values(EXT_PROXIES)
      .map((s) => quotes.get(s))
      .filter((q) => q != null);
    const mode = effectiveSessionMode(proxyQuotes);
    const out: TickerQuote[] = [];
    INSTRUMENTS.forEach((inst, i) => {
      const q = quotes.get(inst.symbol);
      const price = q?.regularMarketPrice;
      if (price == null || price <= 0) return;
      const prev = q?.regularMarketPreviousClose;
      let livePrice = price;
      let sessionMode: ExtendedMode | null = null;
      const proxySymbol = EXT_PROXIES[inst.symbol];
      const proxy = proxySymbol != null ? quotes.get(proxySymbol) : undefined;
      if (mode != null && proxy?.regularMarketPrice != null) {
        const ext = sessionPriceOf(proxy, mode);
        if (ext != null && proxy.regularMarketPrice > 0) {
          livePrice = price * (ext / proxy.regularMarketPrice);
          sessionMode = mode;
        }
      }
      out.push({
        key: inst.key,
        label: inst.label,
        price: livePrice,
        changePct: prev != null && prev > 0 ? livePrice / prev - 1 : null,
        spark: sparks[i] ?? [],
        sessionMode,
      });
    });
    return out;
  },
  // v5: index tiles carry the ETF-proxied extended session (+sessionMode).
  ["market-ticker-quotes-v5"],
  { revalidate: 60 },
);

// === İRF holdings tiles ===
// Every fund position as its own tile row under the benchmark basket.
// Quotes ride ONE batched call on a 60s cache; the intraday sparks are a
// chart call per symbol, so they sit behind a separate 5-minute cache —
// 15-minute-interval data loses nothing and Yahoo isn't hammered with
// ~17 chart requests every single minute.

const getCachedHoldingSparks = unstable_cache(
  async (symbolsKey: string): Promise<Record<string, number[]>> => {
    const symbols = symbolsKey.split(",").filter(Boolean);
    const sparks = await Promise.all(
      symbols.map((s) => getIntradaySpark(s).catch(() => [] as number[])),
    );
    const out: Record<string, number[]> = {};
    symbols.forEach((s, i) => {
      out[s] = sparks[i] ?? [];
    });
    return out;
  },
  ["holdings-ticker-sparks-v1"],
  { revalidate: 300 },
);

const getCachedHoldingsTicker = unstable_cache(
  async (payload: string): Promise<TickerQuote[]> => {
    const list = JSON.parse(payload) as {
      s: string;
      n: string;
      sec: string | null;
    }[];
    if (list.length === 0) return [];
    const [quotes, sparks] = await Promise.all([
      getExtendedQuotes(list.map((x) => x.s)),
      getCachedHoldingSparks(list.map((x) => x.s).join(",")),
    ]);
    // Real equities/ETFs print their own pre/post quotes — no ETF proxy
    // here; the majority state across the book decides whether a window
    // is actually live (the same rule the portfolio fold uses).
    const mode = effectiveSessionMode([...quotes.values()]);
    const out: TickerQuote[] = [];
    for (const x of list) {
      const q = quotes.get(toYahooSymbol(x.s));
      const price = q?.regularMarketPrice;
      if (q == null || price == null || price <= 0) continue;
      let livePrice = price;
      let sessionMode: ExtendedMode | null = null;
      if (mode != null) {
        const ext = sessionPriceOf(q, mode);
        if (ext != null) {
          livePrice = ext;
          sessionMode = mode;
        }
      }
      const prev = q.regularMarketPreviousClose;
      out.push({
        key: `h-${x.s.toLowerCase()}`,
        label: x.s,
        name: x.n,
        sector: x.sec,
        price: livePrice,
        changePct: prev != null && prev > 0 ? livePrice / prev - 1 : null,
        spark: sparks[x.s] ?? [],
        sessionMode,
      });
    }
    return out;
  },
  ["holdings-ticker-quotes-v1"],
  { revalidate: 60 },
);

/**
 * One tile per fund holding (cash rows excluded), keyed `h-<ticker>`.
 * Reads the sheet's cached holdings itself so the dashboard can fetch it
 * in the same parallel pass as everything else; failures degrade to an
 * empty list — the benchmark row renders either way.
 */
export async function getHoldingsTicker(): Promise<TickerQuote[]> {
  try {
    const holdings = await getHoldings();
    const list = holdings
      .filter((h) => !h.isCash && h.symbol.trim() !== "" && h.sharesHeld > 0)
      .map((h) => ({
        s: h.symbol.trim().toUpperCase(),
        n: h.name,
        sec: h.sector,
      }));
    if (list.length === 0) return [];
    return await Promise.race([
      getCachedHoldingsTicker(JSON.stringify(list)),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("holdings ticker timeout")), 4000),
      ),
    ]);
  } catch (err) {
    console.error("[market-ticker] holdings ticker failed:", err);
    return [];
  }
}

/**
 * The panel's 5-year dated history for one instrument key, served by
 * /api/ticker-history when a tile expands. Unknown keys yield [].
 * `h-<ticker>` keys serve fund holdings — validated against the CURRENT
 * sheet book, so the endpoint never becomes an open Yahoo proxy.
 */
export async function getTickerHistory(key: string): Promise<HistoryPoint[]> {
  if (key.startsWith("h-")) {
    const ticker = key.slice(2).trim().toUpperCase();
    if (!ticker) return [];
    try {
      const holdings = await getHoldings();
      const held = holdings.some(
        (h) =>
          !h.isCash &&
          h.symbol.trim().toUpperCase() === ticker &&
          h.sharesHeld > 0,
      );
      if (!held) return [];
      return await getCached5y(ticker);
    } catch (err) {
      console.error(`[market-ticker] holding history failed for ${key}:`, err);
      return [];
    }
  }
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
