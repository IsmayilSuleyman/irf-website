import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

// Extended-hours (pre/after-market) quotes from Yahoo Finance for the
// Watchlist symbols. Yahoo has no official API; yahoo-finance2 handles the
// cookie/crumb dance for the quote endpoint.

export type ExtendedQuote = {
  symbol: string;
  marketState: string | null; // PRE | REGULAR | POST | POSTPOST | CLOSED ...
  regularMarketPrice: number | null;
  regularMarketPreviousClose: number | null;
  preMarketPrice: number | null;
  preMarketChangePercent: number | null;
  postMarketPrice: number | null;
  postMarketChangePercent: number | null;
};

// Sheet symbols are free-form ("nvda", "OPEN", "BATS:DRAM", "BRK.B"); Yahoo
// wants a bare uppercase ticker: exchange prefixes stripped, dots (share
// classes) as dashes.
export function toYahooSymbol(raw: string): string {
  return raw.trim().toUpperCase().replace(/^.*:/, "").replace(/\./g, "-");
}

// Placeholder rows in the sheet that are not tickers (Yahoo would happily
// match "CASH" to a real NASDAQ stock).
const NON_TICKERS = new Set(["CASH"]);

export function isTickerSymbol(raw: string): boolean {
  const s = toYahooSymbol(raw);
  return s.length > 0 && !NON_TICKERS.has(s);
}

const numOrNull = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Fetch quotes for many symbols in one call; keyed by Yahoo symbol. */
export async function getExtendedQuotes(
  symbols: string[],
): Promise<Map<string, ExtendedQuote>> {
  const map = new Map<string, ExtendedQuote>();
  const unique = [...new Set(symbols.map(toYahooSymbol).filter(Boolean))];
  if (unique.length === 0) return map;

  // validateResult: false — Yahoo adds/renames fields often; we only read a
  // handful of well-established ones and coerce them defensively.
  const results = (await yahooFinance.quote(
    unique,
    {},
    { validateResult: false },
  )) as unknown as Array<Record<string, unknown>>;

  for (const q of results ?? []) {
    const symbol = String(q.symbol ?? "");
    if (!symbol) continue;
    map.set(symbol, {
      symbol,
      marketState: q.marketState == null ? null : String(q.marketState),
      regularMarketPrice: numOrNull(q.regularMarketPrice),
      regularMarketPreviousClose: numOrNull(q.regularMarketPreviousClose),
      preMarketPrice: numOrNull(q.preMarketPrice),
      preMarketChangePercent: numOrNull(q.preMarketChangePercent),
      postMarketPrice: numOrNull(q.postMarketPrice),
      postMarketChangePercent: numOrNull(q.postMarketChangePercent),
    });
  }
  return map;
}
