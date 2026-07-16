import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { USD_TO_AZN, type Holding } from "@/lib/sheets";
import {
  latestSessionTail,
  type SessionHistoryPoint,
  type SessionMode,
} from "@/lib/sessionHistory";

export { latestSessionTail };
export type { SessionHistoryPoint, SessionMode };
import {
  getExtendedQuotes,
  isTickerSymbol,
  toYahooSymbol,
  type ExtendedQuote,
} from "@/lib/yahoo";

// Portfolio revalued at Yahoo's pre/after-market prices, for the dashboard
// badge next to the market countdown. Three windows:
//   pre       — the pre-market session is running (04:00–09:30 ET);
//   post      — the after-market session is running (16:00–20:00 ET);
//   overnight — everything in between (20:00–04:00 ET and weekends): the
//               last extended print is the after-market close, so the badge
//               carries that move until pre-market takes over.
// Only regular trading hours show nothing — the day change covers those.

export type ExtendedMode = "pre" | "post" | "overnight";

export type ExtendedSymbolQuote = {
  /** The extended-hours price itself, USD. */
  priceUsd: number;
  /** Fraction vs the regular price, e.g. 0.0128 for +1.28%. */
  changePct: number;
};

export type ExtendedPortfolio = {
  mode: ExtendedMode;
  /** Fraction, e.g. 0.0103 for +1.03% vs the regular-session value. */
  changePct: number;
  /** AZN difference of the whole stock portfolio at extended prices. */
  deltaAzn: number;
  /** How many holdings actually had an extended-hours price. */
  coveredCount: number;
  totalCount: number;
  /**
   * Per-holding extended quotes for the Fond Portfeli list, keyed by the
   * holding's own symbol upper-cased (the key AllocationList derives), so
   * client components need no Yahoo symbol mapping.
   */
  perSymbol: Record<string, ExtendedSymbolQuote>;
};

/**
 * Pure math: revalue the stock holdings (shares from the Sheet) at extended
 * prices. Positions without an extended quote are carried at their regular
 * price, so they dilute the percentage instead of vanishing from the base.
 * `expected` comes from the wall clock; for pre/post the quotes' majority
 * market state must agree (guards a stale cache at session boundaries).
 * Overnight there is no live session to agree with — the after-market close
 * fields simply persist in the quotes — so no state check applies.
 * Exported for tests.
 */
export function computeExtendedPortfolio(
  holdings: Holding[],
  quotes: ExtendedQuote[],
  expected: ExtendedMode,
): ExtendedPortfolio | null {
  const stocks = holdings.filter(
    (h) => !h.isCash && h.sharesHeld > 0 && isTickerSymbol(h.symbol),
  );
  if (stocks.length === 0) return null;

  const bySymbol = new Map(quotes.map((q) => [q.symbol, q]));

  if (expected !== "overnight") {
    let preCount = 0;
    let postCount = 0;
    for (const q of quotes) {
      if (q.marketState === "PRE") preCount += 1;
      else if (q.marketState === "POST") postCount += 1;
    }
    const half = Math.max(1, Math.ceil(quotes.length / 2));
    const majority: "pre" | "post" | null =
      preCount >= half ? "pre" : postCount >= half ? "post" : null;
    if (majority !== expected) return null;
  }

  // Overnight the freshest extended print is the after-market close.
  const useField = expected === "pre" ? "preMarketPrice" : "postMarketPrice";

  let valueReg = 0;
  let valueExt = 0;
  let coveredCount = 0;
  const perSymbol: Record<string, ExtendedSymbolQuote> = {};
  for (const h of stocks) {
    const q = bySymbol.get(toYahooSymbol(h.symbol));
    const reg = q?.regularMarketPrice ?? h.priceUsd;
    if (!Number.isFinite(reg) || reg <= 0) continue;
    const ext = q?.[useField];
    valueReg += h.sharesHeld * reg;
    valueExt += h.sharesHeld * (ext ?? reg);
    if (ext != null) {
      coveredCount += 1;
      perSymbol[h.symbol.trim().toUpperCase()] = {
        priceUsd: ext,
        changePct: ext / reg - 1,
      };
    }
  }
  if (coveredCount === 0 || valueReg <= 0) return null;

  return {
    mode: expected,
    changePct: valueExt / valueReg - 1,
    deltaAzn: (valueExt - valueReg) * USD_TO_AZN,
    coveredCount,
    totalCount: stocks.length,
    perSymbol,
  };
}

// One shared 60s cache of the quote batch (public market data, same for
// every viewer). Maps don't survive the cache serialization, hence arrays.
const getCachedQuotes = unstable_cache(
  async (symbols: string[]): Promise<ExtendedQuote[]> => {
    const map = await getExtendedQuotes(symbols);
    return [...map.values()];
  },
  ["extended-portfolio-quotes"],
  { revalidate: 60 },
);

/**
 * The extended window the New York clock says we're in right now — the badge
 * fetches/renders in all of them and hides only during regular trading
 * hours (the day change covers those). For pre/post the quotes' majority
 * state must additionally agree, guarding against stale-while-revalidate
 * serving a morning PRE snapshot during POST.
 */
export function currentUsSession(now = new Date()): ExtendedMode | null {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = get("weekday");
  if (weekday === "Sat" || weekday === "Sun") return "overnight";
  const mins = (Number(get("hour")) % 24) * 60 + Number(get("minute"));
  if (mins >= 4 * 60 && mins < 9 * 60 + 30) return "pre"; // 04:00–09:30 ET
  if (mins >= 9 * 60 + 30 && mins < 16 * 60) return null; // regular session
  if (mins >= 16 * 60 && mins < 20 * 60) return "post"; // 16:00–20:00 ET
  return "overnight"; // 20:00–04:00 ET
}

/** True during US regular trading hours (09:30–16:00 ET, weekdays). */
export function currentUsRegularSession(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = get("weekday");
  if (weekday === "Sat" || weekday === "Sun") return false;
  const mins = (Number(get("hour")) % 24) * 60 + Number(get("minute"));
  return mins >= 9 * 60 + 30 && mins < 16 * 60;
}

/**
 * Record one 10-minute snapshot of a live session's % move (pre/post/
 * regular). Overnight never records — the value is frozen at the
 * after-market close. The RPC buckets and first-write-wins, so concurrent
 * renders can't duplicate. Best-effort by design.
 */
export async function recordSessionSnapshot(
  supabase: SupabaseClient,
  mode: SessionMode,
  changePct: number,
): Promise<void> {
  const { error } = await supabase.rpc("record_extended_snapshot", {
    p_mode: mode,
    p_change_pct: changePct,
  });
  if (error) console.error("[extended-portfolio] snapshot record failed:", error);
}

async function fetchSessionHistory(
  supabase: SupabaseClient,
  mode: SessionMode,
  sinceHours: number,
): Promise<SessionHistoryPoint[]> {
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("extended_hours_history")
    .select("bucket_start, mode, change_pct")
    .eq("mode", mode)
    .gte("bucket_start", since)
    .order("bucket_start", { ascending: true });
  if (error) {
    console.error("[extended-portfolio] history fetch failed:", error);
    return [];
  }
  return (data ?? []).map((r) => ({
    t: String(r.bucket_start),
    changePct: Number(r.change_pct),
    mode: r.mode as SessionMode,
  }));
}

/**
 * Points for the badge's hover graph. During pre/post: that session's own
 * points. Overnight: the most recent after-market session (its close is
 * exactly what the overnight badge shows). Only the latest contiguous
 * session tail — yesterday's session never mixes into today's chart.
 */
export async function getExtendedHistory(
  supabase: SupabaseClient,
  mode: ExtendedMode,
): Promise<SessionHistoryPoint[]> {
  const target = mode === "pre" ? "pre" : "post";
  return latestSessionTail(await fetchSessionHistory(supabase, target, 72));
}

/**
 * The full week of intraday (regular-session) points for the countdown
 * chip's daily/weekly chart; the client slices the daily view with
 * latestSessionTail(points, 8).
 */
export async function getRegularHistory(
  supabase: SupabaseClient,
): Promise<SessionHistoryPoint[]> {
  return fetchSessionHistory(supabase, "regular", 7 * 24);
}

/**
 * The portfolio's live day change (vs previous close) during US regular
 * hours; null outside them. Same quote cache and hang guard as the
 * extended computation.
 */
export async function getRegularPortfolio(
  holdings: Holding[],
): Promise<{ changePct: number } | null> {
  if (!currentUsRegularSession()) return null;

  const symbols = [
    ...new Set(
      holdings
        .filter((h) => !h.isCash && h.sharesHeld > 0 && isTickerSymbol(h.symbol))
        .map((h) => toYahooSymbol(h.symbol)),
    ),
  ].sort();
  if (symbols.length === 0) return null;

  try {
    const quotes = await Promise.race([
      getCachedQuotes(symbols),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("yahoo quote timeout")), 4000),
      ),
    ]);

    // Holidays: the clock says "regular" but Yahoo reports CLOSED — skip.
    const regularCount = quotes.filter((q) => q.marketState === "REGULAR").length;
    if (regularCount < Math.max(1, Math.ceil(quotes.length / 2))) return null;

    const bySymbol = new Map(quotes.map((q) => [q.symbol, q]));
    let valuePrev = 0;
    let valueNow = 0;
    let covered = 0;
    for (const h of holdings) {
      if (h.isCash || h.sharesHeld <= 0 || !isTickerSymbol(h.symbol)) continue;
      const q = bySymbol.get(toYahooSymbol(h.symbol));
      const prev = q?.regularMarketPreviousClose;
      const now = q?.regularMarketPrice;
      if (prev == null || now == null || prev <= 0) continue;
      valuePrev += h.sharesHeld * prev;
      valueNow += h.sharesHeld * now;
      covered += 1;
    }
    if (covered === 0 || valuePrev <= 0) return null;
    return { changePct: valueNow / valuePrev - 1 };
  } catch (err) {
    console.error("[extended-portfolio] regular quote fetch failed:", err);
    return null;
  }
}

/** Badge data for the dashboard; null only during regular trading hours. */
export async function getExtendedPortfolio(
  holdings: Holding[],
): Promise<ExtendedPortfolio | null> {
  // No fetch during the regular session — the badge never renders then.
  const expected = currentUsSession();
  if (!expected) return null;

  const symbols = [
    ...new Set(
      holdings
        .filter((h) => !h.isCash && h.sharesHeld > 0 && isTickerSymbol(h.symbol))
        .map((h) => toYahooSymbol(h.symbol)),
    ),
  ].sort();
  if (symbols.length === 0) return null;

  try {
    // A hung Yahoo handshake must not stall the dashboard render — give up
    // after a few seconds and drop the badge for this request.
    const quotes = await Promise.race([
      getCachedQuotes(symbols),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("yahoo quote timeout")), 4000),
      ),
    ]);
    return computeExtendedPortfolio(holdings, quotes, expected);
  } catch (err) {
    console.error("[extended-portfolio] quote fetch failed:", err);
    return null;
  }
}
