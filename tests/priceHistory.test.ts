import { describe, expect, it } from "vitest";
import {
  dayChangeReference,
  findLatestPriceBeforeDate,
  type NavPoint,
} from "@/lib/priceHistory";

// The cron writes a row every Baku midnight labeled with the NEW day but
// holding the PREVIOUS US session's close — weekend rows keep repeating
// Friday's close. This history mirrors the production shape around a
// Tuesday session.
const history: NavPoint[] = [
  { label: "p", price: 25.65, recordedAt: "2026-08-22" }, // Sat: Fri's close
  { label: "p", price: 25.64, recordedAt: "2026-08-23" }, // Sun: Fri's close
  { label: "p", price: 25.28, recordedAt: "2026-08-24" }, // Mon 00:00: Fri's close
  { label: "p", price: 24.82, recordedAt: "2026-08-25" }, // Tue 00:00: MON's close
];

describe("dayChangeReference", () => {
  it("always uses the newest row — it holds the last regular close", () => {
    // During Tuesday's session that's yesterday's (Monday's) close for
    // "bu gün"; in pre/overnight windows it's the latest close, matching
    // the badge's "son bağlanışdan" semantics.
    const ref = dayChangeReference(history);
    expect(ref?.recordedAt).toBe("2026-08-25");
    expect(ref?.price).toBe(24.82);
  });

  it("handles an empty history", () => {
    expect(dayChangeReference([])).toBeNull();
  });
});

describe("findLatestPriceBeforeDate", () => {
  it("excludes rows labeled with the current Baku date", () => {
    const ref = findLatestPriceBeforeDate(
      history,
      new Date("2026-08-25T15:00:00Z"), // Baku date is already the 25th
    );
    expect(ref?.recordedAt).toBe("2026-08-24");
  });
});
