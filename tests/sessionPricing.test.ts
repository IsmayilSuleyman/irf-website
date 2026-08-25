import { describe, expect, it } from "vitest";
import {
  batchMajorityState,
  effectiveSessionMode,
  sessionPriceOf,
} from "@/lib/sessionPricing";
import { mkQuote } from "./fixtures";

const q = (marketState: string | null) => mkQuote({ symbol: "X", marketState });

describe("batchMajorityState", () => {
  it("finds the majority window", () => {
    expect(batchMajorityState([q("PRE"), q("PRE"), q("CLOSED")])).toBe("pre");
    expect(batchMajorityState([q("POST"), q("POST"), q("PRE")])).toBe("post");
  });
  it("returns null when no window reaches half the batch", () => {
    expect(batchMajorityState([q("CLOSED"), q("CLOSED")])).toBeNull();
    expect(
      batchMajorityState([q("PRE"), q("CLOSED"), q("CLOSED")]),
    ).toBeNull();
  });

  it("counts 'at least half', pre checked first — an even tie reads as pre", () => {
    // The wall-clock `expected` gate upstream means a tie can only ever
    // confirm the window the clock already claims; documenting the exact
    // threshold so a refactor can't silently tighten or loosen it.
    expect(batchMajorityState([q("PRE"), q("POST")])).toBe("pre");
  });
});

describe("effectiveSessionMode", () => {
  // 2026-08-26 (Wed): 05:00 EDT = pre window, 17:00 EDT = post window.
  const preNow = new Date("2026-08-26T09:00:00Z");
  const postNow = new Date("2026-08-26T21:00:00Z");
  const regularNow = new Date("2026-08-26T15:00:00Z");
  const weekendNow = new Date("2026-08-29T15:00:00Z");

  it("confirms a live window when the batch agrees", () => {
    expect(effectiveSessionMode([q("PRE"), q("PRE")], preNow)).toBe("pre");
    expect(effectiveSessionMode([q("POST"), q("POST")], postNow)).toBe("post");
  });

  it("falls back to overnight in a pre window whose quotes haven't flipped", () => {
    // 04:00 ET boundary: the clock says pre, the tape still says CLOSED —
    // the after-market close is the freshest extended print.
    expect(effectiveSessionMode([q("CLOSED"), q("CLOSED")], preNow)).toBe(
      "overnight",
    );
  });

  it("yields null for a disagreeing post window and during regular hours", () => {
    expect(effectiveSessionMode([q("CLOSED")], postNow)).toBeNull();
    expect(effectiveSessionMode([q("REGULAR")], regularNow)).toBeNull();
  });

  it("weekends read as overnight regardless of quote state", () => {
    expect(effectiveSessionMode([q("CLOSED")], weekendNow)).toBe("overnight");
  });
});

describe("sessionPriceOf", () => {
  const quote = mkQuote({
    symbol: "X",
    preMarketPrice: 101,
    postMarketPrice: 102,
  });
  it("reads the window's own field (overnight = persisted post close)", () => {
    expect(sessionPriceOf(quote, "pre")).toBe(101);
    expect(sessionPriceOf(quote, "post")).toBe(102);
    expect(sessionPriceOf(quote, "overnight")).toBe(102);
  });
});
