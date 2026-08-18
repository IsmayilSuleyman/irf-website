import { unstable_cache } from "next/cache";
import { USD_TO_AZN } from "@/lib/portfolio";
import {
  getDailyCloses,
  getExtendedQuotes,
  type DailyClose,
} from "@/lib/yahoo";
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
 * the market cost at their fill price and the PAID basis from col G (blank
 * G = market fill; 0 = gift). Sells release units and both bases at the
 * running average — standard cost-basis accounting, col G ignored on sales.
 * Dust below 1e-9 units drops out. P&L runs against the paid basis, so a
 * gifted position counts its whole value as gain.
 */
export function buildAssetPositions(
  holderName: string,
  txs: AssetTransaction[],
  quotes: Record<string, AssetQuote>,
): AssetPosition[] {
  const mine = txs.filter((t) => norm(t.holderName) === norm(holderName));
  const acc = new Map<
    string,
    { units: number; costUsd: number; paidAzn: number }
  >();
  for (const t of mine) {
    const a = acc.get(t.symbol) ?? { units: 0, costUsd: 0, paidAzn: 0 };
    if (t.units >= 0) {
      a.units += t.units;
      a.costUsd += t.units * t.priceUsd;
      a.paidAzn += t.paidAzn ?? t.units * t.priceUsd * USD_TO_AZN;
    } else {
      const sellUnits = Math.min(-t.units, a.units);
      if (a.units > 0) {
        const frac = sellUnits / a.units;
        a.costUsd -= a.costUsd * frac;
        a.paidAzn -= a.paidAzn * frac;
      }
      a.units -= sellUnits;
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
    const costBasisAzn = a.paidAzn;
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

// Daily closes per symbol for the chart overlay; closes change once a day,
// so a 1h cache is plenty. Failures read as "no history" and the overlay
// falls back to valuing that symbol at cost.
const getCachedDailyCloses = unstable_cache(
  async (symbol: string, days: number): Promise<DailyClose[]> => {
    try {
      return await getDailyCloses(symbol, days);
    } catch (err) {
      console.error(
        `[personal-assets] closes fetch failed for ${symbol}:`,
        err,
      );
      return [];
    }
  },
  ["personal-asset-closes"],
  { revalidate: 3600 },
);

/**
 * Last-month daily closes per symbol, for the Aktivlərim row sparklines.
 * Rides the same 1h closes cache as the chart overlay; a failed symbol is
 * just an empty series.
 */
export async function getAssetMonthSparks(
  symbols: string[],
): Promise<Record<string, number[]>> {
  const unique = [...new Set(symbols.map((s) => s.trim().toUpperCase()))]
    .filter(Boolean)
    .sort();
  const entries = await Promise.all(
    unique.map(
      async (s) =>
        [s, (await getCachedDailyCloses(s, 35)).map((c) => c.close)] as const,
    ),
  );
  return Object.fromEntries(entries);
}

export type AssetOverlayPoint = { valueAzn: number; investedAzn: number };

/**
 * The holder's ETF book valued at each requested date (ISO YYYY-MM-DD keys),
 * for adding onto the İRF value chart so the Tarixçə headline, the plotted
 * series and Aktivlərim's total all describe the same personal book. null
 * when the holder has no ledger rows. Dates before a symbol's first close
 * (or symbols whose history fetch fails) are valued at cost.
 */
export async function getAssetValueOverlay(
  holderName: string,
  txs: AssetTransaction[],
  dates: string[],
): Promise<Record<string, AssetOverlayPoint> | null> {
  const mine = txs.filter((t) => norm(t.holderName) === norm(holderName));
  if (mine.length === 0 || dates.length === 0) return null;

  // Ledger rows follow the Transactions tab's date convention (parseable by
  // new Date); an unparseable date reads as "held from the start" so the
  // position never silently vanishes from the chart.
  const txMs = (t: AssetTransaction) => {
    const n = new Date(t.date).getTime();
    return Number.isFinite(n) ? n : 0;
  };
  const earliest = Math.min(...mine.map(txMs));
  const days = Math.min(
    2000,
    Math.max(30, Math.ceil((Date.now() - Math.max(earliest, 0)) / 86_400_000) + 7),
  );
  const symbols = [...new Set(mine.map((t) => t.symbol))].sort();
  const closesBySymbol = new Map<string, DailyClose[]>();
  await Promise.all(
    symbols.map(async (s) => {
      closesBySymbol.set(s, await getCachedDailyCloses(s, days));
    }),
  );

  // Closes come back ascending; the last one at or before the date wins.
  const closeAtOrBefore = (symbol: string, date: string): number | null => {
    const closes = closesBySymbol.get(symbol) ?? [];
    let best: number | null = null;
    for (const c of closes) {
      if (c.t <= date) best = c.close;
      else break;
    }
    return best;
  };

  const out: Record<string, AssetOverlayPoint> = {};
  for (const date of dates) {
    const dayEnd = new Date(`${date}T23:59:59Z`).getTime();
    // Same fold as buildAssetPositions: market cost for pricing fallbacks,
    // PAID basis (col G, gifts = 0) for the Maya dəyəri overlay.
    const held = new Map<
      string,
      { units: number; costUsd: number; paidAzn: number }
    >();
    for (const t of mine) {
      if (txMs(t) > dayEnd) continue;
      const a = held.get(t.symbol) ?? { units: 0, costUsd: 0, paidAzn: 0 };
      if (t.units >= 0) {
        a.units += t.units;
        a.costUsd += t.units * t.priceUsd;
        a.paidAzn += t.paidAzn ?? t.units * t.priceUsd * USD_TO_AZN;
      } else {
        const sellUnits = Math.min(-t.units, a.units);
        if (a.units > 0) {
          const frac = sellUnits / a.units;
          a.costUsd -= a.costUsd * frac;
          a.paidAzn -= a.paidAzn * frac;
        }
        a.units -= sellUnits;
      }
      held.set(t.symbol, a);
    }
    let valueAzn = 0;
    let investedAzn = 0;
    for (const [symbol, a] of held) {
      if (a.units <= 1e-9) continue;
      const close = closeAtOrBefore(symbol, date);
      const px = close ?? (a.units > 0 ? a.costUsd / a.units : 0);
      valueAzn += a.units * px * USD_TO_AZN;
      investedAzn += a.paidAzn;
    }
    out[date] = { valueAzn, investedAzn };
  }
  return out;
}
