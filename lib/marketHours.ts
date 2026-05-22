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

type EtDate = { y: number; mo: number; d: number };

// Wall-clock fields of an instant in America/New_York.
function etParts(at: Date) {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  let hour = get("hour");
  if (hour === 24) hour = 0;
  return { y: get("year"), mo: get("month"), d: get("day"), hour, minute: get("minute"), second: get("second") };
}

// ET offset (minutes) at an instant, e.g. -300 (EST) / -240 (EDT). Robust across
// runtimes: read the ET wall clock, treat it as UTC, diff from the real instant.
function etOffsetMinutes(at: Date): number {
  const e = etParts(at);
  const asIfUtc = Date.UTC(e.y, e.mo - 1, e.d, e.hour, e.minute, e.second);
  return Math.round((asIfUtc - at.getTime()) / 60000);
}

// Convert an ET wall-clock time to the corresponding UTC instant.
function etWallToUtc(y: number, mo: number, d: number, h: number, mi: number): Date {
  const asUtc = Date.UTC(y, mo - 1, d, h, mi, 0);
  const off = etOffsetMinutes(new Date(asUtc));
  return new Date(asUtc - off * 60000);
}

const pad2 = (n: number) => String(n).padStart(2, "0");

function isTradingDate(y: number, mo: number, d: number): boolean {
  const wd = new Date(Date.UTC(y, mo - 1, d)).getUTCDay(); // 0 Sun .. 6 Sat
  if (wd === 0 || wd === 6) return false;
  return !US_MARKET_HOLIDAYS.has(`${y}-${pad2(mo)}-${pad2(d)}`);
}

function addDays({ y, mo, d }: EtDate, n: number): EtDate {
  const dt = new Date(Date.UTC(y, mo - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return { y: dt.getUTCFullYear(), mo: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

/**
 * When the US market next changes state, and whether it is open right now.
 * If open → the next close (16:00 ET today). If closed → the next open
 * (09:30 ET on the next trading day, skipping weekends and holidays).
 */
export function nextUsMarketTransition(now: Date = new Date()): { open: boolean; at: Date } {
  const open = isUsMarketOpen(now);
  const e = etParts(now);
  const today: EtDate = { y: e.y, mo: e.mo, d: e.d };

  if (open) {
    return { open, at: etWallToUtc(today.y, today.mo, today.d, 16, 0) };
  }

  for (let i = 0; i < 14; i++) {
    const day = addDays(today, i);
    if (!isTradingDate(day.y, day.mo, day.d)) continue;
    const at = etWallToUtc(day.y, day.mo, day.d, 9, 30);
    if (at.getTime() > now.getTime()) return { open, at };
  }
  // Unreachable in practice (14-day lookahead covers any holiday cluster).
  return { open, at: etWallToUtc(today.y, today.mo, today.d, 9, 30) };
}
