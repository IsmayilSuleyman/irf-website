// US equity market (NYSE/NASDAQ) regular session: 09:30–16:00 ET, Mon–Fri,
// excluding market holidays. Half-day early closes (13:00) are treated as full
// days here. Update the holiday list yearly.
const US_MARKET_HOLIDAYS = new Set<string>([
  // 2026
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25",
  "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
  // 2027
  "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31",
  "2027-06-18", "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
]);

/** True when the US stock market is in its regular trading session. */
export function isUsMarketOpen(now: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  const weekday = get("weekday");
  if (weekday === "Sat" || weekday === "Sun") return false;

  const dateKey = `${get("year")}-${get("month")}-${get("day")}`;
  if (US_MARKET_HOLIDAYS.has(dateKey)) return false;

  let hour = parseInt(get("hour"), 10);
  if (hour === 24) hour = 0; // some runtimes report midnight as "24"
  const minutes = hour * 60 + parseInt(get("minute"), 10);

  return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}
