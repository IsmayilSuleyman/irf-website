import { unstable_cache } from "next/cache";
import { USD_TO_AZN } from "@/lib/portfolio";
import { getExtendedQuotes } from "@/lib/yahoo";
import type { AssetTransaction } from "@/lib/sheets";

// The personal ETF desk: holders (everyone but İsmayıl) buy SPY/IBIT/GLDM/
// SIVR through İsmayıl — orders are agreed verbally, outside the app — and
// the Aktivlər sheet tab is the ledger. This module folds that ledger into
// live-valued positions, kept fully separate from İRF pays.

export const PURCHASABLE_ASSETS = [
  { key: "sp500", symbol: "SPY", label: "S&P 500" },
  { key: "btc", symbol: "IBIT", label: "Bitcoin" },
  { key: "gold", symbol: "GLDM", label: "Qızıl" },
  { key: "silver", symbol: "SIVR", label: "Gümüş" },
] as const;

export type AssetQuote = {
  priceUsd: number | null;
  prevCloseUsd: number | null;
};

export type AssetPosition = {
  symbol: string;
  /** Display name; falls back to the ticker for symbols outside the base set. */
  label: string;
  /** assetIcons key, when the symbol is one of the base four. */
  iconKey: string | null;
  units: number;
  avgBuyUsd: number | null;
  costBasisAzn: number;
  priceUsd: number | null;
  valueAzn: number | null;
  dayChangePct: number | null;
  dayChangeAzn: number | null;
  totalPnlAzn: number | null;
  totalPnlPct: number | null;
};

// Same holder-name normalization the bazar uses to match sheet names.
const norm = (s: string) =>
  s.trim().toLocaleLowerCase("az-AZ").replace(/\s+/g, " ");

const metaOf = (symbol: string) =>
  PURCHASABLE_ASSETS.find((a) => a.symbol === symbol) ?? null;

// One shared 60s cache per symbol set (public market data; entries as
// tuples because Maps don't survive the cache serialization).
const getCachedAssetQuotes = unstable_cache(
  async (symbols: string[]): Promise<Array<[string, AssetQuote]>> => {
    const map = await getExtendedQuotes(symbols);
    return symbols.map((s) => {
      const q = map.get(s);
      return [
        s,
        {
          priceUsd: q?.regularMarketPrice ?? null,
          prevCloseUsd: q?.regularMarketPreviousClose ?? null,
        },
      ];
    });
  },
  ["personal-asset-quotes"],
  { revalidate: 60 },
);

/**
 * Live quotes for the given tickers, keyed by symbol; {} on failure so a
 * Yahoo outage degrades to unvalued positions, never a broken page.
 */
export async function getAssetQuotes(
  symbols: string[],
): Promise<Record<string, AssetQuote>> {
  const unique = [...new Set(symbols.map((s) => s.trim().toUpperCase()))]
    .filter(Boolean)
    .sort();
  if (unique.length === 0) return {};
  try {
    const entries = await Promise.race([
      getCachedAssetQuotes(unique),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("yahoo asset quote timeout")), 4000),
      ),
    ]);
    return Object.fromEntries(entries);
  } catch (err) {
    console.error("[personal-assets] quote fetch failed:", err);
    return {};
  }
}

/**
 * Fold one holder's ledger rows into live-valued positions. Buys accumulate
 * cost at their fill price; sells release units at the running average (the
 * average buy price itself doesn't move on a sale — standard cost-basis
 * accounting). Dust below 1e-9 units drops out.
 */
export function buildAssetPositions(
  holderName: string,
  txs: AssetTransaction[],
  quotes: Record<string, AssetQuote>,
): AssetPosition[] {
  const mine = txs.filter((t) => norm(t.holderName) === norm(holderName));
  const acc = new Map<string, { units: number; costUsd: number }>();
  for (const t of mine) {
    const a = acc.get(t.symbol) ?? { units: 0, costUsd: 0 };
    if (t.units >= 0) {
      a.units += t.units;
      a.costUsd += t.units * t.priceUsd;
    } else {
      const sellUnits = Math.min(-t.units, a.units);
      const avg = a.units > 0 ? a.costUsd / a.units : 0;
      a.units -= sellUnits;
      a.costUsd -= sellUnits * avg;
    }
    acc.set(t.symbol, a);
  }

  const out: AssetPosition[] = [];
  for (const [symbol, a] of acc) {
    if (a.units <= 1e-9) continue;
    const meta = metaOf(symbol);
    const q = quotes[symbol];
    const price = q?.priceUsd ?? null;
    const prev = q?.prevCloseUsd ?? null;
    const avgBuyUsd = a.units > 0 ? a.costUsd / a.units : null;
    const costBasisAzn = a.costUsd * USD_TO_AZN;
    const valueAzn = price != null ? a.units * price * USD_TO_AZN : null;
    out.push({
      symbol,
      label: meta?.label ?? symbol,
      iconKey: meta?.key ?? null,
      units: a.units,
      avgBuyUsd,
      costBasisAzn,
      priceUsd: price,
      valueAzn,
      dayChangePct:
        price != null && prev != null && prev > 0 ? price / prev - 1 : null,
      dayChangeAzn:
        price != null && prev != null
          ? a.units * (price - prev) * USD_TO_AZN
          : null,
      totalPnlAzn: valueAzn != null ? valueAzn - costBasisAzn : null,
      totalPnlPct:
        valueAzn != null && costBasisAzn > 0
          ? valueAzn / costBasisAzn - 1
          : null,
    });
  }
  out.sort((x, y) => (y.valueAzn ?? 0) - (x.valueAzn ?? 0));
  return out;
}
