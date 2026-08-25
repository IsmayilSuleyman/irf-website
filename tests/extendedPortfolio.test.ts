import { describe, expect, it } from "vitest";
import { computeExtendedPortfolio } from "@/lib/extendedPortfolio";
import { USD_TO_AZN } from "@/lib/sheets";
import { mkHolding, mkQuote } from "./fixtures";

describe("computeExtendedPortfolio", () => {
  it("measures the delta against the SHEET price, so sheet + delta ≡ shares × ext", () => {
    // Sheet says 100 while Yahoo's regular print is 104 (GOOGLEFINANCE lag)
    // — the delta must still make sheetValue + delta a real valuation.
    const holdings = [mkHolding({ symbol: "NVDA", priceUsd: 100, sharesHeld: 10 })];
    const quotes = [
      mkQuote({
        symbol: "NVDA",
        marketState: "POST",
        regularMarketPrice: 104,
        postMarketPrice: 105,
      }),
    ];
    const r = computeExtendedPortfolio(holdings, quotes, "post");
    expect(r).not.toBeNull();
    expect(r!.deltaAzn).toBeCloseTo(10 * (105 - 100) * USD_TO_AZN, 10);
    // sheetValue + delta = shares × extPrice, identically.
    const sheetValueAzn = 10 * 100 * USD_TO_AZN;
    expect(sheetValueAzn + r!.deltaAzn).toBeCloseTo(10 * 105 * USD_TO_AZN, 10);
    expect(r!.changePct).toBeCloseTo(105 / 100 - 1, 10);
    expect(r!.perSymbol.NVDA.changePct).toBeCloseTo(0.05, 10);
  });

  it("rejects a pre/post window whose quote majority disagrees (stale cache)", () => {
    const holdings = [mkHolding({ symbol: "NVDA", sharesHeld: 5 })];
    const quotes = [
      mkQuote({
        symbol: "NVDA",
        marketState: "POST",
        regularMarketPrice: 100,
        preMarketPrice: 101,
      }),
    ];
    expect(computeExtendedPortfolio(holdings, quotes, "pre")).toBeNull();
  });

  it("overnight needs no state agreement — the after-market close persists", () => {
    const holdings = [mkHolding({ symbol: "NVDA", sharesHeld: 5 })];
    const quotes = [
      mkQuote({
        symbol: "NVDA",
        marketState: "CLOSED",
        regularMarketPrice: 100,
        postMarketPrice: 102,
        postMarketTimeMs: 1_700_000_000_000,
      }),
    ];
    const r = computeExtendedPortfolio(holdings, quotes, "overnight");
    expect(r).not.toBeNull();
    expect(r!.mode).toBe("overnight");
    expect(r!.deltaAzn).toBeCloseTo(5 * 2 * USD_TO_AZN, 10);
    expect(r!.asOfMs).toBe(1_700_000_000_000);
  });

  it("carries uncovered positions at their sheet price (dilution, coveredCount)", () => {
    const holdings = [
      mkHolding({ symbol: "AAA", priceUsd: 100, sharesHeld: 1 }),
      mkHolding({ symbol: "BBB", priceUsd: 100, sharesHeld: 1 }),
    ];
    const quotes = [
      mkQuote({
        symbol: "AAA",
        marketState: "CLOSED",
        postMarketPrice: 110,
      }),
      mkQuote({ symbol: "BBB", marketState: "CLOSED" }),
    ];
    const r = computeExtendedPortfolio(holdings, quotes, "overnight");
    expect(r).not.toBeNull();
    expect(r!.coveredCount).toBe(1);
    expect(r!.totalCount).toBe(2);
    // +10% on half the base dilutes to +5% overall.
    expect(r!.changePct).toBeCloseTo(0.05, 10);
    expect(Object.keys(r!.perSymbol)).toEqual(["AAA"]);
  });

  it("returns null when no position has an extended print", () => {
    const holdings = [mkHolding({ symbol: "AAA", sharesHeld: 1 })];
    const quotes = [mkQuote({ symbol: "AAA", marketState: "CLOSED" })];
    expect(computeExtendedPortfolio(holdings, quotes, "overnight")).toBeNull();
  });

  it("skips cash and zero-share rows entirely", () => {
    const holdings = [
      mkHolding({ symbol: "CASH", isCash: true, sharesHeld: 100 }),
      mkHolding({ symbol: "AAA", sharesHeld: 0 }),
      mkHolding({ symbol: "BBB", priceUsd: 50, sharesHeld: 2 }),
    ];
    const quotes = [
      mkQuote({ symbol: "BBB", marketState: "CLOSED", postMarketPrice: 51 }),
    ];
    const r = computeExtendedPortfolio(holdings, quotes, "overnight");
    expect(r).not.toBeNull();
    expect(r!.totalCount).toBe(1);
    expect(r!.deltaAzn).toBeCloseTo(2 * 1 * USD_TO_AZN, 10);
  });
});
