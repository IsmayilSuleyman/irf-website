import { describe, expect, it } from "vitest";
import {
  availableSparkRanges,
  dailySparkWindows,
  initialSparkRange,
  latestSessionSpark,
  thinSeries,
  toSpark,
} from "@/lib/sparkRanges";

const DAY_MS = 86_400_000;
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

describe("thinSeries", () => {
  it("leaves a series at or under the cap untouched", () => {
    expect(thinSeries([1, 2, 3], 3)).toEqual([1, 2, 3]);
    expect(thinSeries([1, 2], 190)).toEqual([1, 2]);
  });

  it("strides back from the newest point so the latest-value dot is real", () => {
    // 10 points, cap 4 → stride 3 from index 9: 9, 6, 3, 0.
    expect(thinSeries(range(10), 4)).toEqual([0, 3, 6, 9]);
    // 11 points, cap 4 → stride 3 from index 10: 10, 7, 4, 1 — the oldest
    // drops, the newest never does.
    expect(thinSeries(range(11), 4)).toEqual([1, 4, 7, 10]);
  });

  it("never exceeds the cap", () => {
    for (const n of [191, 252, 365, 720, 781]) {
      const out = thinSeries(range(n), 190);
      expect(out.length).toBeLessThanOrEqual(190);
      expect(out[out.length - 1]).toBe(n - 1);
    }
  });
});

describe("toSpark", () => {
  it("rounds to 5 significant digits and drops non-finite values", () => {
    expect(toSpark([49.0699996948242, Number.NaN, 237.19000244140625])).toEqual(
      [49.07, 237.19],
    );
    expect(toSpark([118_765.4321, 0.000123456])).toEqual([118_770, 0.00012346]);
  });

  it("thins a year of closes to the six-month density", () => {
    const out = toSpark(range(252).map((i) => 100 + i));
    expect(out.length).toBe(126);
    expect(out[out.length - 1]).toBe(351);
  });
});

describe("dailySparkWindows", () => {
  const now = Date.parse("2026-10-05T12:00:00Z");
  // One point per calendar day for 400 days, oldest first, valued by age.
  const points = range(400)
    .reverse()
    .map((age) => ({
      t: new Date(now - age * DAY_MS).toISOString().slice(0, 10),
      v: 1000 - age,
    }));

  it("slices the last half year and the last year on the wall clock", () => {
    const { half, year } = dailySparkWindows(points, now);
    // Both windows end on the newest value…
    expect(half?.[half.length - 1]).toBe(1000);
    expect(year?.[year.length - 1]).toBe(1000);
    // …and the half-year starts ~183 days back (183 points, under the cap).
    expect(half?.length).toBe(183);
    expect(half?.[0]).toBe(1000 - 182);
    // The year (365 points) thins under the cap without losing its span.
    expect(year!.length).toBeLessThanOrEqual(190);
    expect(year![0]).toBeLessThanOrEqual(1000 - 360);
  });

  it("accepts full ISO timestamps and drops unreadable dates", () => {
    const { half } = dailySparkWindows(
      [
        { t: "not a date", v: 1 },
        { t: "2026-10-01T09:30:00Z", v: 2 },
        { t: "2026-10-04T09:30:00Z", v: 3 },
      ],
      now,
    );
    expect(half).toEqual([2, 3]);
  });

  it("returns empty windows for an empty series", () => {
    expect(dailySparkWindows([], now)).toEqual({ half: [], year: [] });
  });
});

describe("initialSparkRange / availableSparkRanges", () => {
  it("opens on Günlük when any row has it", () => {
    const sets = [{ day: [1, 2], half: [1, 2] }, { half: [3, 4] }];
    expect(initialSparkRange(sets)).toBe("day");
    expect(availableSparkRanges(sets)).toEqual(["day", "half"]);
  });

  it("falls back to a window rows can draw when the intraday fetch failed", () => {
    const sets = [{ day: [], half: [1, 2], year: [1, 2] }, undefined];
    expect(initialSparkRange(sets)).toBe("half");
  });

  it("keeps the default when nothing can draw (the picker hides then)", () => {
    expect(initialSparkRange([{ day: [5] }])).toBe("day");
    expect(availableSparkRanges([{ day: [5] }])).toEqual([]);
  });
});

describe("latestSessionSpark", () => {
  const MIN = 60_000;
  // Minute points ending at `endMs`, valued by the generator.
  const series = (endMs: number, minutes: number, f: (i: number) => number) =>
    range(minutes).map((i) => ({
      date: new Date(endMs - (minutes - 1 - i) * MIN).toISOString(),
      value: f(i),
    }));
  const now = Date.parse("2026-10-04T12:00:00Z"); // a Sunday

  it("draws the last session, not a flat weekend line", () => {
    // 26h day tier: entirely flat (Sunday) — must fall through to the week tier.
    const day = series(now, 26 * 60, () => 25);
    // Week tier: 4h closed gap, an 8h session climbing 20→25, then 40h flat.
    const week = [
      ...series(now - 48 * 60 * MIN, 4 * 60, () => 20),
      ...series(now - 40 * 60 * MIN, 8 * 60, (i) => 20 + (5 * (i + 1)) / 480),
      ...series(now, 40 * 60, () => 25),
    ];
    const out = latestSessionSpark([day, week]);
    expect(out.length).toBeGreaterThan(100);
    // Opens at the previous close level, ends at the last move's price.
    expect(out[0]).toBe(20);
    expect(out[out.length - 1]).toBe(25);
    expect(Math.min(...out)).toBe(20);
  });

  it("uses the fine tier while the price is moving", () => {
    const day = series(now, 26 * 60, (i) => 25 + Math.sin(i / 30));
    const out = latestSessionSpark([day, []]);
    expect(out.length).toBeGreaterThan(100);
    expect(out[out.length - 1]).toBe(
      Number((25 + Math.sin((26 * 60 - 1) / 30)).toPrecision(5)),
    );
  });

  it("is empty with no usable tier", () => {
    expect(latestSessionSpark([[], []])).toEqual([]);
    expect(latestSessionSpark([series(now, 30, () => 1)])).toEqual([]);
  });
});
