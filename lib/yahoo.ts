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

export type DailyClose = { t: string; close: number }; // t = "YYYY-MM-DD"

/**
 * Daily closes for one symbol going back `days` calendar days, ascending.
 * Used for the momentum board's SPY reference returns.
 */
export async function getDailyCloses(
  symbol: string,
  days: number,
): Promise<DailyClose[]> {
  const period2 = new Date();
  const period1 = new Date(period2.getTime() - days * 86_400_000);
  const res = (await yahooFinance.chart(
    toYahooSymbol(symbol),
    { period1, period2, interval: "1d" },
    { validateResult: false },
  )) as unknown as { quotes?: Array<{ date?: unknown; close?: unknown }> };

  const out: DailyClose[] = [];
  for (const q of res?.quotes ?? []) {
    const close = Number(q?.close);
    const d =
      q?.date instanceof Date ? q.date : new Date(String(q?.date ?? ""));
    if (!Number.isFinite(close) || close <= 0 || Number.isNaN(d.getTime()))
      continue;
    out.push({ t: d.toISOString().slice(0, 10), close });
  }
  out.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));
  return out;
}

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
