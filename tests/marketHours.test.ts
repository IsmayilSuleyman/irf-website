import { describe, expect, it } from "vitest";
import {
  currentUsRegularSession,
  currentUsSession,
  isUsMarketOpen,
} from "@/lib/marketHours";

// Instants are UTC; New York is EDT (UTC-4) in August, EST (UTC-5) in
// December. 2026-08-26 is a Wednesday.
const at = (iso: string) => new Date(iso);

describe("currentUsSession", () => {
  it("returns null during the regular session (summer)", () => {
    expect(currentUsSession(at("2026-08-26T15:00:00Z"))).toBeNull(); // 11:00 EDT
    expect(currentUsRegularSession(at("2026-08-26T15:00:00Z"))).toBe(true);
  });

  it("maps the extended windows (summer)", () => {
    expect(currentUsSession(at("2026-08-26T09:00:00Z"))).toBe("pre"); // 05:00 EDT
    expect(currentUsSession(at("2026-08-26T21:00:00Z"))).toBe("post"); // 17:00 EDT
    expect(currentUsSession(at("2026-08-27T01:00:00Z"))).toBe("overnight"); // 21:00 EDT Wed
  });

  it("flips exactly at the 09:30 ET open", () => {
    expect(currentUsSession(at("2026-08-26T13:29:00Z"))).toBe("pre");
    expect(currentUsSession(at("2026-08-26T13:30:00Z"))).toBeNull();
  });

  it("flips exactly at the 16:00 ET close", () => {
    expect(currentUsSession(at("2026-08-26T19:59:00Z"))).toBeNull();
    expect(currentUsSession(at("2026-08-26T20:00:00Z"))).toBe("post");
  });

  it("treats weekends as overnight all day", () => {
    expect(currentUsSession(at("2026-08-29T15:00:00Z"))).toBe("overnight"); // Saturday
    expect(currentUsRegularSession(at("2026-08-29T15:00:00Z"))).toBe(false);
  });

  it("treats market holidays as overnight all day", () => {
    // Labor Day 2026 (Mon Sep 7), mid-"session" hours.
    expect(currentUsSession(at("2026-09-07T15:00:00Z"))).toBe("overnight");
    expect(isUsMarketOpen(at("2026-09-07T15:00:00Z"))).toBe(false);
    // Christmas 2026 (Fri Dec 25).
    expect(currentUsSession(at("2026-12-25T16:00:00Z"))).toBe("overnight");
  });

  it("handles winter (EST) offsets", () => {
    // Mon 2026-12-28, 10:00 EST = 15:00 UTC — regular session.
    expect(currentUsSession(at("2026-12-28T15:00:00Z"))).toBeNull();
    // 05:00 EST = 10:00 UTC — pre-market.
    expect(currentUsSession(at("2026-12-28T10:00:00Z"))).toBe("pre");
  });

  it("agrees with isUsMarketOpen everywhere", () => {
    const samples = [
      "2026-08-26T09:00:00Z",
      "2026-08-26T15:00:00Z",
      "2026-08-26T21:00:00Z",
      "2026-08-29T15:00:00Z",
      "2026-09-07T15:00:00Z",
      "2026-12-28T15:00:00Z",
    ];
    for (const s of samples) {
      expect(currentUsSession(at(s)) === null).toBe(isUsMarketOpen(at(s)));
    }
  });
});
