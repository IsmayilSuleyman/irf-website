import { currentUsSession, type ExtendedMode } from "@/lib/marketHours";
import type { ExtendedQuote } from "@/lib/yahoo";

// Shared session-price selection: which extended window a quote batch
// should be read with, and the price that window carries. The İRF fold
// (lib/extendedPortfolio) and the personal ETF quotes (lib/personalAssets)
// both answer these questions HERE, so the two paths cannot drift apart.

/**
 * Majority marketState of a batch — guards a stale-while-revalidate cache
 * serving a morning PRE snapshot during POST at session boundaries.
 */
export function batchMajorityState(
  quotes: Pick<ExtendedQuote, "marketState">[],
): "pre" | "post" | null {
  let preCount = 0;
  let postCount = 0;
  for (const q of quotes) {
    if (q.marketState === "PRE") preCount += 1;
    else if (q.marketState === "POST") postCount += 1;
  }
  const half = Math.max(1, Math.ceil(quotes.length / 2));
  return preCount >= half ? "pre" : postCount >= half ? "post" : null;
}

/**
 * The extended window this batch should actually be read with right now:
 * the wall-clock window, majority-guarded for pre/post. A pre window whose
 * quotes haven't flipped yet (04:00 ET boundary) falls back to overnight —
 * the after-market close is still the freshest extended print. Null means
 * no extended pricing applies (regular session, or a post window whose
 * quotes disagree).
 */
export function effectiveSessionMode(
  quotes: Pick<ExtendedQuote, "marketState">[],
  now = new Date(),
): ExtendedMode | null {
  const expected = currentUsSession(now);
  if (!expected) return null;
  if (expected === "overnight") return "overnight";
  const majority = batchMajorityState(quotes);
  if (majority === expected) return expected;
  return expected === "pre" ? "overnight" : null;
}

/** The price the given window carries for one quote (overnight reads the
 *  persisted after-market close). */
export function sessionPriceOf(
  q: Pick<ExtendedQuote, "preMarketPrice" | "postMarketPrice">,
  mode: ExtendedMode,
): number | null {
  return mode === "pre" ? q.preMarketPrice : q.postMarketPrice;
}
