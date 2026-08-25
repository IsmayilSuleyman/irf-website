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
  const tuesdaySession = new Date("2026-08-25T15:00:00Z"); // during Tue's US session

  it("uses the newest row during the regular session (it holds yesterday's close)", () => {
    const ref = dayChangeReference(history, true, tuesdaySession);
    expect(ref?.recordedAt).toBe("2026-08-25");
    expect(ref?.price).toBe(24.82);
  });

  it("keeps the strict-before reference outside regular hours", () => {
    // Post/overnight after Tuesday's close: "bu gün" = Tuesday's full
    // session + its after-hours ride, measured against Monday's close —
    // which sits in the row LABELED Tuesday.
    const ref = dayChangeReference(history, false, tuesdaySession);
    expect(ref?.recordedAt).toBe("2026-08-24");
    expect(ref?.price).toBe(25.28);
  });

  it("handles an empty history", () => {
    expect(dayChangeReference([], true)).toBeNull();
    expect(dayChangeReference([], false)).toBeNull();
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
