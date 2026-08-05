import { unstable_cache } from "next/cache";
import { getIndexSnapshot } from "@/lib/yahoo";

// Sentiment and drawdown inputs for the investment policy's cash-deployment
// rule (lib/investmentPolicy §4): the CNN Fear & Greed zone and the S&P
// 500's distance from its all-time high. Both are best-effort — a failed
// fetch yields null and the policy card reports the trigger as unknown
// rather than wrong.

export type FearGreed = { score: number; rating: string };
/** drawdown is ≤ 0, a fraction (−0.15 = 15% below the all-time high). */
export type Sp500Drawdown = {
  price: number;
  allTimeHigh: number;
  drawdown: number;
};

export type MarketSignals = {
  fearGreed: FearGreed | null;
  sp500: Sp500Drawdown | null;
};

const FEAR_GREED_URL =
  "https://production.dataviz.cnn.io/index/fearandgreed/graphdata";

async function fetchFearGreed(): Promise<FearGreed | null> {
  try {
    // CNN's dataviz endpoint rejects the default undici user agent; any
    // browser-looking UA passes.
    const res = await fetch(FEAR_GREED_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      fear_and_greed?: { score?: unknown; rating?: unknown };
    };
    const score = Number(json?.fear_and_greed?.score);
    const rating = String(json?.fear_and_greed?.rating ?? "").trim();
    if (!Number.isFinite(score)) return null;
    return { score: Math.round(score), rating };
  } catch {
    return null;
  }
}

export const getMarketSignals = unstable_cache(
  async (): Promise<MarketSignals> => {
    const [fearGreed, index] = await Promise.all([
      fetchFearGreed(),
      getIndexSnapshot("^GSPC"),
    ]);
    return {
      fearGreed,
      sp500: index
        ? {
            price: index.price,
            allTimeHigh: index.allTimeHigh,
            drawdown: index.price / index.allTimeHigh - 1,
          }
        : null,
    };
  },
  ["market-signals"],
  { revalidate: 1800, tags: ["market-signals"] },
);

/** Null when the signal is unavailable, otherwise whether CNN reads Extreme Fear. */
export function isExtremeFear(fg: FearGreed | null): boolean | null {
  if (!fg) return null;
  return /extreme\s*fear/i.test(fg.rating) || fg.score <= 25;
}
