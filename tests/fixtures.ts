import type { Holding } from "@/lib/sheets";
import type { ExtendedQuote } from "@/lib/yahoo";

// Minimal fixture builders: only the fields the pricing logic reads get
// real values; the rest are inert defaults.

export function mkHolding(partial: Partial<Holding> & { symbol: string }): Holding {
  return {
    name: partial.symbol,
    priceUsd: 100,
    avgPurchaseUsd: null,
    sharesHeld: 1,
    costBasisAzn: 0,
    valueAzn: 0,
    percent: 0,
    isCash: false,
    changePct: null,
    dayChangePct: null,
    dayChangeUsd: null,
    totalPnlUsd: null,
    sector: null,
    ref4wUsd: null,
    ref13wUsd: null,
    refYtdUsd: null,
    avg200Usd: null,
    ...partial,
  };
}

export function mkQuote(
  partial: Partial<ExtendedQuote> & { symbol: string },
): ExtendedQuote {
  return {
    marketState: null,
    regularMarketPrice: null,
    regularMarketPreviousClose: null,
    preMarketPrice: null,
    preMarketChangePercent: null,
    postMarketPrice: null,
    postMarketChangePercent: null,
    preMarketTimeMs: null,
    postMarketTimeMs: null,
    ...partial,
  };
}
