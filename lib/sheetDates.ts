// Sheet date cells arrive as displayed text, so the format is whatever the
// cell (or the person typing) produced: ISO "2026-05-14", the day-first
// Azerbaijani convention "14.05.2026" (dots or dashes), the US slash order
// "5/14/2026", or a full ISO timestamp on rows that came from Supabase.
// new Date() alone reads day-first strings as Invalid Date — or, when the
// day is ≤ 12, silently swaps day and month — either of which can make a
// position appear on the chart months before it was actually bought. Every
// consumer that folds transactions by date parses through here instead.

// Valid calendar date in a sane range → UTC-midnight ms, else null. The
// round-trip check rejects roll-overs (Feb 31 must not become Mar 3).
function utcMs(y: number, mo: number, d: number): number | null {
  if (y < 100) y += 2000;
  if (y < 1990 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const ms = Date.UTC(y, mo - 1, d);
  const check = new Date(ms);
  return check.getUTCMonth() === mo - 1 && check.getUTCDate() === d ? ms : null;
}

/**
 * Epoch ms for a sheet date cell (UTC midnight for date-only values, the
 * actual instant for ISO timestamps), or null when the text holds no
 * recognizable date. Dots and dashes read day-first ("14.05.2026"); slashes
 * keep the US order the ledger has always used ("5/14/2026"). Whenever the
 * preferred read is an impossible date, the other order is tried before
 * giving up.
 */
export function parseSheetDateMs(
  value: string | null | undefined,
): number | null {
  const s = value?.trim();
  if (!s) return null;

  // ISO first: date-only pinned to UTC so folds don't shift across server
  // timezones; timestamps (Supabase settled_at/created_at) keep their time.
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})([T ].*)?$/.exec(s);
  if (m) {
    if (m[4]) {
      const n = new Date(s).getTime();
      if (Number.isFinite(n)) return n;
    }
    return utcMs(+m[1], +m[2], +m[3]);
  }

  m = /^(\d{1,2})([./\-])(\d{1,2})\2(\d{2}|\d{4})$/.exec(s);
  if (m) {
    const a = +m[1];
    const b = +m[3];
    const y = +m[4];
    return m[2] === "/"
      ? (utcMs(y, a, b) ?? utcMs(y, b, a))
      : (utcMs(y, b, a) ?? utcMs(y, a, b));
  }

  const n = new Date(s).getTime();
  return Number.isFinite(n) ? n : null;
}
