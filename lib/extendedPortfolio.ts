import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { USD_TO_AZN, type Holding } from "@/lib/sheets";
import {
  latestSessionTail,
  type SessionHistoryPoint,
  type SessionMode,
} from "@/lib/sessionHistory";
import {
  currentUsRegularSession,
  currentUsSession,
  type ExtendedMode,
} from "@/lib/marketHours";

export { latestSessionTail, currentUsRegularSession, currentUsSession };
export type { SessionHistoryPoint, SessionMode, ExtendedMode };
import {
  getExtendedQuotes,
  isTickerSymbol,
  toYahooSymbol,
  type ExtendedQuote,
} from "@/lib/yahoo";

// Portfolio revalued at Yahoo's pre/after-market prices — the dashboard
// badge AND the 24/7 fold into the headline figures. Three windows:
//   pre       — the pre-market session is running (04:00–09:30 ET);
//   post      — the after-market session is running (16:00–20:00 ET);
//   overnight — everything in between (20:00–04:00 ET, weekends and market
//               holidays): the last extended print is the after-market
//               close, so the fold carries that move until pre-market
//               takes over.
// During regular trading hours getRegularPortfolio supplies the same kind
// of delta from live regular prices instead (the Sheet's GOOGLEFINANCE
// runs ~15-20 min behind). The session clock lives in lib/marketHours
// (client-safe, holiday-aware) and is re-exported here.

export type ExtendedSymbolQuote = {
  /** The extended-hours price itself, USD. */
  priceUsd: number;
  /** Fraction vs the regular price, e.g. 0.0128 for +1.28%. */
  changePct: number;
  /**
   * AZN difference of this holding at the extended price. Same convention as
   * ExtendedPortfolio.deltaAzn: converted from USD once, here, so the client
   * only formats. A future currency-mode setting swaps the conversion at
   * this single point (or ships the raw USD delta alongside).
   */
  deltaAzn: number;
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
  /** Newest print time among the quotes used (epoch ms) — the honest
   *  "as of" for a fold that may be hours old on a weekend. */
  asOfMs: number | null;
  /**
   * Per-holding extended quotes for the Fond Portfeli list, keyed by the
   * holding's own symbol upper-cased (the key AllocationList derives), so
   * client components need no Yahoo symbol mapping.
   */
  perSymbol: Record<string, ExtendedSymbolQuote>;
};

/**
 * Pure math: revalue the stock holdings (shares from the Sheet) at extended
 * prices. The base is the SHEET's own price per holding — not Yahoo's
 * regular print — so `sheetValue + deltaAzn ≡ shares × extPrice`
 * identically, even while GOOGLEFINANCE lags the close or a snapshot
 * fallback serves older sheet prices. Positions without an extended quote
 * are carried at their sheet price, so they dilute the percentage instead
 * of vanishing from the base. `expected` comes from the wall clock; for
 * pre/post the quotes' majority market state must agree (guards a stale
 * cache at session boundaries). Overnight there is no live session to
 * agree with — the after-market close fields simply persist in the quotes
 * — so no state check applies. Exported for tests.
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
  const timeField = expected === "pre" ? "preMarketTimeMs" : "postMarketTimeMs";

  // Two bases, deliberately different: the ₼ delta measures against the
  // SHEET price so sheet + delta is a real valuation, while the displayed
  // and recorded PERCENTAGES measure against Yahoo's settled regular print
  // — otherwise GOOGLEFINANCE's post-close catch-up would step the badge %
  // and the session-history chart while the extended price never moved.
  let valueBase = 0;
  let valueExt = 0;
  let pctBaseSum = 0;
  let pctExtSum = 0;
  let coveredCount = 0;
  let asOfMs: number | null = null;
  const perSymbol: Record<string, ExtendedSymbolQuote> = {};
  for (const h of stocks) {
    const q = bySymbol.get(toYahooSymbol(h.symbol));
    const base = h.priceUsd;
    if (!Number.isFinite(base) || base <= 0) continue;
    const ext = q?.[useField];
    const pctBase =
      q?.regularMarketPrice != null && q.regularMarketPrice > 0
        ? q.regularMarketPrice
        : base;
    valueBase += h.sharesHeld * base;
    valueExt += h.sharesHeld * (ext ?? base);
    pctBaseSum += h.sharesHeld * pctBase;
    pctExtSum += h.sharesHeld * (ext ?? pctBase);
    if (ext != null) {
      coveredCount += 1;
      const t = q?.[timeField];
      if (t != null && (asOfMs == null || t > asOfMs)) asOfMs = t;
      perSymbol[h.symbol.trim().toUpperCase()] = {
        priceUsd: ext,
        changePct: ext / pctBase - 1,
        deltaAzn: h.sharesHeld * (ext - base) * USD_TO_AZN,
      };
    }
  }
  if (coveredCount === 0 || valueBase <= 0) return null;

  return {
    mode: expected,
    changePct:
      pctBaseSum > 0 ? pctExtSum / pctBaseSum - 1 : valueExt / valueBase - 1,
    deltaAzn: (valueExt - valueBase) * USD_TO_AZN,
    coveredCount,
    totalCount: stocks.length,
    asOfMs,
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

function holdingSymbols(holdings: Holding[]): string[] {
  return [
    ...new Set(
      holdings
        .filter((h) => !h.isCash && h.sharesHeld > 0 && isTickerSymbol(h.symbol))
        .map((h) => toYahooSymbol(h.symbol)),
    ),
  ].sort();
}

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("yahoo quote timeout")), ms),
    ),
  ]);

export type RegularPortfolio = {
  /** Fraction vs previous close — the session-history chart's unit. */
  changePct: number;
  /**
   * AZN difference vs the SHEET's current prices (not vs previous close):
   * sheetValue + deltaAzn ≡ live value, and the delta self-shrinks to zero
   * as GOOGLEFINANCE catches up — double-count-proof by construction.
   */
  deltaAzn: number;
};

/**
 * The portfolio's live regular-session read during US regular hours; null
 * outside them. changePct is vs previous close (for the session-history
 * chart); deltaAzn is vs the Sheet's own prices (for the 24/7 headline
 * fold). Same quote cache and hang guard as the extended computation, with
 * a last-good fallback so a transient Yahoo failure can't yank the fold
 * out of the headline for one render.
 */
/**
 * Pure math for the regular-session read: changePct vs previous close and
 * deltaAzn vs the Sheet's own prices. Guarded by the batch's own majority
 * marketState (early-close half days report CLOSED/POST while the clock
 * still says "regular"). Exported for the live-pricing endpoint and tests.
 */
export function computeRegularPortfolio(
  holdings: Holding[],
  quotes: ExtendedQuote[],
): RegularPortfolio | null {
  const regularCount = quotes.filter((q) => q.marketState === "REGULAR").length;
  if (regularCount < Math.max(1, Math.ceil(quotes.length / 2))) return null;

  const bySymbol = new Map(quotes.map((q) => [q.symbol, q]));
  let valuePrev = 0;
  let valueNow = 0;
  let valueSheet = 0;
  let valueNowForSheet = 0;
  let covered = 0;
  for (const h of holdings) {
    if (h.isCash || h.sharesHeld <= 0 || !isTickerSymbol(h.symbol)) continue;
    const q = bySymbol.get(toYahooSymbol(h.symbol));
    const prev = q?.regularMarketPreviousClose;
    const now = q?.regularMarketPrice;
    if (prev == null || now == null || prev <= 0) continue;
    valuePrev += h.sharesHeld * prev;
    valueNow += h.sharesHeld * now;
    if (Number.isFinite(h.priceUsd) && h.priceUsd > 0) {
      valueSheet += h.sharesHeld * h.priceUsd;
      valueNowForSheet += h.sharesHeld * now;
    }
    covered += 1;
  }
  if (covered === 0 || valuePrev <= 0) return null;
  return {
    changePct: valueNow / valuePrev - 1,
    deltaAzn: (valueNowForSheet - valueSheet) * USD_TO_AZN,
  };
}

export async function getRegularPortfolio(
  holdings: Holding[],
): Promise<RegularPortfolio | null> {
  if (!currentUsRegularSession()) return null;

  const symbols = holdingSymbols(holdings);
  if (symbols.length === 0) return null;

  try {
    const quotes = await withTimeout(getCachedQuotes(symbols), 4000);
    let result = computeRegularPortfolio(holdings, quotes);
    if (!result) {
      // 09:30 boundary: the cached batch may still say PRE/CLOSED for the
      // first cache window of the session — same uncached retry as the
      // extended path, so the open has no guaranteed dead minute.
      try {
        const fresh = await withTimeout(
          getExtendedQuotes(symbols).then((m) => [...m.values()]),
          3000,
        );
        result = computeRegularPortfolio(holdings, fresh);
      } catch {
        // fall through to lastGood below
      }
    }
    if (result) {
      lastGoodRegular = { portfolio: result, atMs: Date.now() };
      return result;
    }
    return lastGoodRegularFresh();
  } catch (err) {
    console.error("[extended-portfolio] regular quote fetch failed:", err);
    // Serve the last good read for a few minutes rather than dropping the
    // fold (and visibly lurching the headline) over one bad fetch.
    return lastGoodRegularFresh();
  }
}

function lastGoodRegularFresh(): RegularPortfolio | null {
  return lastGoodRegular && Date.now() - lastGoodRegular.atMs < 10 * 60_000
    ? lastGoodRegular.portfolio
    : null;
}

// Last good results, per instance — the lastGoodSnapshot recipe from
// lib/sheets. A transient Yahoo timeout or a stale-while-revalidate batch
// failing the majority guard must not zero six headline surfaces for one
// render and snap them back the next.
let lastGoodRegular: { portfolio: RegularPortfolio; atMs: number } | null = null;
let lastGoodExtended: { portfolio: ExtendedPortfolio; atMs: number } | null =
  null;

/** How stale a saved extended fold may be served: the cap keys off the
 *  SAVED fold's mode (an overnight fold is frozen at the after-market
 *  close, so the long cap applies to it wherever it is served); the mode
 *  match accepts the windows' natural neighbors — a pre window rides an
 *  overnight fold (the 04:00 fallback saves as "overnight"), and an
 *  overnight window rides a just-ended post fold (numerically the same
 *  close). Without these, one Yahoo timeout at a session boundary would
 *  blank six headline surfaces at once. */
function lastGoodExtendedFresh(expected: ExtendedMode): ExtendedPortfolio | null {
  if (!lastGoodExtended) return null;
  const saved = lastGoodExtended.portfolio;
  const modeOk =
    saved.mode === expected ||
    (expected === "pre" && saved.mode === "overnight") ||
    (expected === "overnight" && saved.mode === "post");
  if (!modeOk) return null;
  const age = Date.now() - lastGoodExtended.atMs;
  const cap = saved.mode === "overnight" ? 3 * 24 * 3_600_000 : 10 * 60_000;
  return age < cap ? saved : null;
}

export type LiveFundDelta = {
  /** AZN move of the fund's stock book vs the Sheet's prices, right now. */
  deltaAzn: number;
  /** The extended session behind it; null during regular hours. */
  mode: ExtendedMode | null;
};

// The live-pricing endpoint's own quote cache: 5s instead of 60s, so the
// polled headline figures tick near-real-time while every concurrent
// viewer still shares ONE upstream Yahoo call per window.
const getFastQuotes = unstable_cache(
  async (symbols: string[]): Promise<ExtendedQuote[]> => {
    const map = await getExtendedQuotes(symbols);
    return [...map.values()];
  },
  ["live-pricing-quotes"],
  { revalidate: 5 },
);

/**
 * The 3-5s ticker's read: same fold as getLiveFundDelta, on the 5s quote
 * cache, with no retries or last-good machinery — the client polls again
 * in a few seconds anyway and keeps its previous value on failure.
 */
export async function getLiveFundDeltaFast(
  holdings: Holding[],
): Promise<(LiveFundDelta & { asOfMs: number | null }) | null> {
  const symbols = holdingSymbols(holdings);
  if (symbols.length === 0) return null;
  try {
    const quotes = await withTimeout(getFastQuotes(symbols), 4000);
    const expected = currentUsSession();
    if (expected) {
      // Same fallback chain as the full fold: a claimed window whose
      // quotes aren't printing rides the persisted after-market close.
      const ext =
        computeExtendedPortfolio(holdings, quotes, expected) ??
        (expected !== "overnight"
          ? computeExtendedPortfolio(holdings, quotes, "overnight")
          : null);
      return ext
        ? { deltaAzn: ext.deltaAzn, mode: ext.mode, asOfMs: ext.asOfMs }
        : null;
    }
    const reg = computeRegularPortfolio(holdings, quotes);
    return reg ? { deltaAzn: reg.deltaAzn, mode: null, asOfMs: null } : null;
  } catch (err) {
    console.error("[extended-portfolio] fast quote fetch failed:", err);
    return null;
  }
}

/**
 * The one-number version of the 24/7 fold, for pages that only need "how
 * far is the fund from its Sheet valuation right now" (the /bank podium):
 * the extended fold when a session is on, the live regular delta otherwise.
 */
export async function getLiveFundDelta(
  holdings: Holding[],
): Promise<LiveFundDelta> {
  const ext = await getExtendedPortfolio(holdings);
  if (ext) return { deltaAzn: ext.deltaAzn, mode: ext.mode };
  const reg = await getRegularPortfolio(holdings);
  return { deltaAzn: reg?.deltaAzn ?? 0, mode: null };
}

/**
 * The extended fold for the dashboard; null only during regular trading
 * hours (when getRegularPortfolio takes over). Resilient by design:
 *   1. a stale cached batch failing the pre/post majority guard retries
 *      once with an uncached fetch (first render after an idle gap);
 *   2. a pre-market window whose quotes still say CLOSED (04:00 boundary)
 *      falls back to the overnight computation — the persisted after-market
 *      close — instead of returning nothing;
 *   3. errors and residual nulls serve the last good same-mode result for
 *      a bounded window, so the headline never flickers by the delta.
 */
export async function getExtendedPortfolio(
  holdings: Holding[],
): Promise<ExtendedPortfolio | null> {
  const expected = currentUsSession();
  if (!expected) return null;

  const symbols = holdingSymbols(holdings);
  if (symbols.length === 0) return null;

  try {
    // A hung Yahoo handshake must not stall the dashboard render — give up
    // after a few seconds and fall through to the last good result.
    const quotes = await withTimeout(getCachedQuotes(symbols), 4000);
    let result = computeExtendedPortfolio(holdings, quotes, expected);

    if (!result && expected !== "overnight") {
      // The window is claimed but the batch disagrees. When NO quote shows
      // a live extended state, the session simply isn't printing (04:00
      // boundary, or a half-day whose after-hours already ended) — the
      // after-market close is the freshest extended print, and skipping
      // the uncached retry keeps quiet windows from paying an extra Yahoo
      // call every render.
      const anyLive = quotes.some(
        (q) => q.marketState === "PRE" || q.marketState === "POST",
      );
      if (!anyLive) {
        result = computeExtendedPortfolio(holdings, quotes, "overnight");
      }
      if (!result) {
        // Mixed/stale states (SWR after an idle gap): one uncached retry
        // with a tighter deadline settles whether the session is on.
        try {
          const fresh = await withTimeout(
            getExtendedQuotes(symbols).then((m) => [...m.values()]),
            3000,
          );
          result =
            computeExtendedPortfolio(holdings, fresh, expected) ??
            computeExtendedPortfolio(holdings, fresh, "overnight");
        } catch {
          // fall through to lastGood below
        }
      }
    }

    if (result) {
      lastGoodExtended = { portfolio: result, atMs: Date.now() };
      return result;
    }
    return lastGoodExtendedFresh(expected);
  } catch (err) {
    console.error("[extended-portfolio] quote fetch failed:", err);
    return lastGoodExtendedFresh(expected);
  }
}
