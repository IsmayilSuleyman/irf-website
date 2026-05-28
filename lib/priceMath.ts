export const COMMISSION = 0.03;

export const buyPrice = (current: number): number => current * (1 + COMMISSION);
export const sellPrice = (current: number): number => current * (1 - COMMISSION);

/**
 * Best prices a holder can actually transact at, combining the Fund's always-on
 * quotes with the live participant order book:
 *   ask (Alış)  = cheapest way to buy 1 pay = lowest of { Fund ask, lowest sell order }.
 *                 Fund ask counts only while the Fund is selling (fundCanSell);
 *                 null when the Fund isn't selling and no sell orders rest.
 *   bid (Satış) = best price to sell 1 pay  = highest of { Fund bid, highest buy order }.
 *                 Always defined — the Fund buyback is always on.
 */
export function bestQuotes(
  current: number,
  bestBuyOrder: number | null,
  bestSellOrder: number | null,
  fundCanSell: boolean,
): { ask: number | null; bid: number } {
  const askCandidates: number[] = [];
  if (fundCanSell) askCandidates.push(buyPrice(current));
  if (bestSellOrder != null && bestSellOrder > 0) askCandidates.push(bestSellOrder);
  const ask = askCandidates.length ? Math.min(...askCandidates) : null;

  const fundBid = sellPrice(current);
  const bid =
    bestBuyOrder != null && bestBuyOrder > 0
      ? Math.max(fundBid, bestBuyOrder)
      : fundBid;

  return { ask, bid };
}
