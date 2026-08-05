// İsmayıl's written Investment Policy Rules (effective 2026-08-05), as code.
// The constants below ARE the policy: targets and caps (§1), the 8% single-
// name limit (§2), the quarterly ratchet (§3), the cash dip-buying rule (§4),
// contribution routing (§5) and the Sep 2026 – Feb 2027 unwind schedule (§6).
// They live in version control on purpose — §7 requires a dated, written
// record and a 30-day cooling-off before any change, and a git history of
// this file is exactly that record. Do not move these into an editable
// settings row.
//
// Pure and client-safe: no server imports, no module-level clock reads.
// Sleeve classification rides on the Watchlist's free-text Sector column
// (same keyword vocabulary as components/SectorIcon.tsx) plus a symbol
// override list for funds whose sector text would mislead the policy — a
// bitcoin ETF is "ETF" to the sheet but Bitcoin to the caps.

export type Sleeve = "broadEtf" | "stocks" | "metals" | "bitcoin" | "cash";
export type SleeveKind = "floor" | "cap";

export const SLEEVE_ORDER: Sleeve[] = [
  "broadEtf",
  "stocks",
  "metals",
  "bitcoin",
  "cash",
];

// Labels double as the SectorIcon lookup string — each one keyword-matches
// the intended glyph (etf / fallback pie / metals / crypto / cash).
export const SLEEVE_LABELS: Record<Sleeve, string> = {
  broadEtf: "Geniş bazar ETF-i",
  stocks: "Fərdi səhmlər",
  metals: "Qiymətli metallar",
  bitcoin: "Bitkoin",
  cash: "Nağd ehtiyat",
};

export const POLICY = {
  effectiveDate: "2026-08-05",
  sleeves: {
    broadEtf: { limit: 0.4, kind: "floor" as SleeveKind },
    stocks: { limit: 0.25, kind: "cap" as SleeveKind },
    metals: { limit: 0.15, kind: "cap" as SleeveKind },
    bitcoin: { limit: 0.1, kind: "cap" as SleeveKind },
    cash: { limit: 0.1, kind: "cap" as SleeveKind },
  },
  /** §3: a capped sleeve more than 2pp above its cap forces a quarterly sell. */
  ratchetBand: 0.02,
  /** §2: no single stock above 8% of the whole portfolio. */
  singleNameCap: 0.08,
  /** §4: S&P this far (or further) below its all-time high arms dip-buying. */
  cashDeployDrawdown: -0.15,
  /** §4: deploy one third of the cash sleeve per month while armed. */
  cashDeployFraction: 1 / 3,
  /** §6: sell 1/6 of the stocks-sleeve excess on each month's first trading day. */
  unwind: { startYear: 2026, startMonth: 9, months: 6 },
  /** §3: allocation checks on the first trading day of these months. */
  quarterMonths: [1, 4, 7, 10],
  /** Salary lands at month end, obligations clear by the 10th, invest on the 15th. */
  contributionDay: 15,
  debtsDay: 10,
  /** §7: days between a written amendment decision and its execution. */
  coolingOffDays: 30,
} as const;

// ---------------------------------------------------------------------------
// Sleeve classification

// Funds whose Sector cell would put them in the wrong sleeve. Keyed by the
// normalized ticker (exchange prefix stripped, dots as dashes — the same
// normalization lib/yahoo.ts applies).
const SYMBOL_SLEEVES: Record<string, Sleeve> = {
  // Broad-market index funds (S&P 500 / total market, US + UCITS tickers).
  SPY: "broadEtf",
  VOO: "broadEtf",
  IVV: "broadEtf",
  SPLG: "broadEtf",
  VTI: "broadEtf",
  ITOT: "broadEtf",
  SCHB: "broadEtf",
  CSPX: "broadEtf",
  VUSA: "broadEtf",
  SPYL: "broadEtf",
  VT: "broadEtf",
  ACWI: "broadEtf",
  // Bitcoin exposure wrapped as funds.
  IBIT: "bitcoin",
  FBTC: "bitcoin",
  GBTC: "bitcoin",
  ARKB: "bitcoin",
  BITO: "bitcoin",
  HODL: "bitcoin",
  BTCO: "bitcoin",
  // Precious-metal funds.
  GLD: "metals",
  IAU: "metals",
  GLDM: "metals",
  SGOL: "metals",
  PHYS: "metals",
  SLV: "metals",
  SIVR: "metals",
  PSLV: "metals",
};

// Order matters: "Bitcoin ETF" or "Qızıl ETF" as sector text must resolve to
// the asset, not to the broad-ETF sleeve, so /etf/ is tested last.
const SLEEVE_MATCHERS: [RegExp, Sleeve][] = [
  [/qiymətli|metal|qızıl|gold|gümüş|silver/, "metals"],
  [/kripto|crypto|bitkoin|bitcoin|btc/, "bitcoin"],
  [/etf|indeks|index/, "broadEtf"],
];

const normalizeSymbol = (raw: string): string =>
  raw.trim().toUpperCase().replace(/^.*:/, "").replace(/\./g, "-");

// Azerbaijani "İ" lowercases to "i" + combining dot (U+0307) in JS; strip the
// dot so the regexes above still match (same trick as SectorIcon).
const azFold = (s: string): string => s.toLowerCase().replace(/̇/g, "");

export function sleeveOf(h: {
  symbol: string;
  sector: string | null;
  isCash: boolean;
}): Sleeve {
  if (h.isCash) return "cash";
  const override = SYMBOL_SLEEVES[normalizeSymbol(h.symbol)];
  if (override) return override;
  const s = azFold(h.sector ?? "");
  for (const [re, sleeve] of SLEEVE_MATCHERS) if (re.test(s)) return sleeve;
  return "stocks";
}

// ---------------------------------------------------------------------------
// Dates — everything is a Baku-calendar "YYYY-MM-DD" string so comparisons
// are plain string comparisons and nothing depends on the server's timezone.

const BAKU_OFFSET_MS = 4 * 60 * 60 * 1000; // Asia/Baku is UTC+4, no DST

export function bakuTodayIso(now: Date = new Date()): string {
  return new Date(now.getTime() + BAKU_OFFSET_MS).toISOString().slice(0, 10);
}

const ymd = (y: number, m: number, d: number): string =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

// Only the NYSE holidays that can collide with a month's first weekday: New
// Year's Day (and its Monday observance), Labor Day (first Monday of
// September) and Independence Day with its Fri/Mon observances. Anything
// rarer than that shifts a planned date by a day — the schedule is a plan,
// not an execution engine.
function isMarketHoliday(m: number, d: number, dow: number): boolean {
  if (m === 1 && (d === 1 || (d === 2 && dow === 1))) return true;
  if (m === 9 && dow === 1 && d <= 7) return true;
  if (m === 7 && (d === 4 || (d === 3 && dow === 5) || (d === 5 && dow === 1)))
    return true;
  return false;
}

export function firstTradingDayIso(year: number, month: number): string {
  for (let d = 1; d <= 10; d++) {
    const dow = new Date(Date.UTC(year, month - 1, d)).getUTCDay();
    if (dow === 0 || dow === 6) continue;
    if (isMarketHoliday(month, d, dow)) continue;
    return ymd(year, month, d);
  }
  return ymd(year, month, 1); // unreachable — 10 days always contain a weekday
}

// Manual month names for the same reason lib/portfolio formats AZN manually:
// the az-AZ Intl locale differs between Node and browsers.
const AZ_MONTHS = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avqust",
  "sentyabr",
  "oktyabr",
  "noyabr",
  "dekabr",
];
const AZ_MONTHS_SHORT = [
  "yan",
  "fev",
  "mar",
  "apr",
  "may",
  "iyn",
  "iyl",
  "avq",
  "sen",
  "okt",
  "noy",
  "dek",
];

export function formatPolicyDate(
  iso: string,
  style: "long" | "short" = "long",
): string {
  const [y, m, d] = iso.split("-").map(Number);
  const months = style === "short" ? AZ_MONTHS_SHORT : AZ_MONTHS;
  const name = months[(m ?? 1) - 1] ?? "";
  return style === "short" ? `${d} ${name}` : `${d} ${name} ${y}`;
}

// ---------------------------------------------------------------------------
// The report

export type PolicyHoldingInput = {
  symbol: string;
  name: string;
  valueAzn: number;
  sector: string | null;
  isCash: boolean;
};

export type SleeveStatus = "ok" | "over" | "trim" | "under";

export type SleeveRow = {
  sleeve: Sleeve;
  label: string;
  kind: SleeveKind;
  limit: number; // fraction of portfolio
  valueAzn: number;
  actualPct: number; // fraction of portfolio
  status: SleeveStatus;
  /** Caps: AZN above the cap (the trim amount). Floor: AZN short of the floor. */
  deltaAzn: number;
};

export type PositionBreach = {
  symbol: string;
  name: string;
  pct: number; // fraction of portfolio
  excessAzn: number;
};

export type UnwindMonth = {
  date: string; // first trading day, "YYYY-MM-DD"
  status: "past" | "next" | "future";
};

export type PolicyReport = {
  totalAzn: number;
  today: string;
  sleeves: SleeveRow[];
  breaches: PositionBreach[];
  broadEtfBelowFloor: boolean;
  unwind: {
    excessAzn: number;
    monthlySellAzn: number;
    monthsRemaining: number;
    finished: boolean;
    schedule: UnwindMonth[];
  };
  nextContribution: string;
  nextQuarterCheck: string;
};

export function computePolicyReport(
  holdings: PolicyHoldingInput[],
  now: Date = new Date(),
): PolicyReport {
  const today = bakuTodayIso(now);
  const totalAzn = holdings.reduce((s, h) => s + Math.max(0, h.valueAzn), 0);

  const sleeveValues: Record<Sleeve, number> = {
    broadEtf: 0,
    stocks: 0,
    metals: 0,
    bitcoin: 0,
    cash: 0,
  };
  const stockPositions: PolicyHoldingInput[] = [];
  for (const h of holdings) {
    if (h.valueAzn <= 0) continue;
    const sleeve = sleeveOf(h);
    sleeveValues[sleeve] += h.valueAzn;
    if (sleeve === "stocks") stockPositions.push(h);
  }

  const sleeves: SleeveRow[] = SLEEVE_ORDER.map((sleeve) => {
    const { limit, kind } = POLICY.sleeves[sleeve];
    const valueAzn = sleeveValues[sleeve];
    const actualPct = totalAzn > 0 ? valueAzn / totalAzn : 0;
    let status: SleeveStatus = "ok";
    let deltaAzn = 0;
    if (kind === "floor") {
      if (actualPct < limit) {
        status = "under";
        deltaAzn = limit * totalAzn - valueAzn;
      }
    } else if (actualPct > limit) {
      status = actualPct > limit + POLICY.ratchetBand ? "trim" : "over";
      deltaAzn = valueAzn - limit * totalAzn;
    }
    return {
      sleeve,
      label: SLEEVE_LABELS[sleeve],
      kind,
      limit,
      valueAzn,
      actualPct,
      status,
      deltaAzn,
    };
  });

  // §2 — single-name breaches, largest first (they also sell first, §6).
  const breaches: PositionBreach[] = stockPositions
    .map((h) => ({
      symbol: h.symbol,
      name: h.name,
      pct: totalAzn > 0 ? h.valueAzn / totalAzn : 0,
      excessAzn: h.valueAzn - POLICY.singleNameCap * totalAzn,
    }))
    .filter((b) => b.pct > POLICY.singleNameCap)
    .sort((a, b) => b.pct - a.pct);

  // §6 — the unwind. The excess is recomputed live, so the per-month amount
  // is (current excess / months left) rather than a frozen 1/6 of the
  // September figure: if a scheduled sell is executed the next month's amount
  // shrinks accordingly, and if one is missed the remainder redistributes.
  const schedule: UnwindMonth[] = [];
  for (let i = 0; i < POLICY.unwind.months; i++) {
    const m0 = POLICY.unwind.startMonth - 1 + i;
    const date = firstTradingDayIso(
      POLICY.unwind.startYear + Math.floor(m0 / 12),
      (m0 % 12) + 1,
    );
    schedule.push({ date, status: date < today ? "past" : "future" });
  }
  const next = schedule.find((s) => s.status !== "past");
  if (next) next.status = "next";

  const stocksValue = sleeveValues.stocks;
  const excessAzn = Math.max(
    0,
    stocksValue - POLICY.sleeves.stocks.limit * totalAzn,
  );
  const monthsRemaining = schedule.filter((s) => s.status !== "past").length;
  const unwind = {
    excessAzn,
    monthlySellAzn: monthsRemaining > 0 ? excessAzn / monthsRemaining : 0,
    monthsRemaining,
    finished: monthsRemaining === 0,
    schedule,
  };

  // §5 — next contribution date (the 15th; salary at month end, debts by the
  // 10th, so the 15th is the standing investment day).
  const [ty, tm, td] = today.split("-").map(Number);
  let cy = ty;
  let cm = tm;
  if (td > POLICY.contributionDay) {
    cm += 1;
    if (cm > 12) {
      cm = 1;
      cy += 1;
    }
  }
  const nextContribution = ymd(cy, cm, POLICY.contributionDay);

  // §3 — next quarterly ratchet check.
  let nextQuarterCheck = "";
  outer: for (let y = ty; y <= ty + 1; y++) {
    for (const m of POLICY.quarterMonths) {
      const iso = firstTradingDayIso(y, m);
      if (iso >= today) {
        nextQuarterCheck = iso;
        break outer;
      }
    }
  }

  return {
    totalAzn,
    today,
    sleeves,
    breaches,
    broadEtfBelowFloor: sleeves[0].status === "under",
    unwind,
    nextContribution,
    nextQuarterCheck,
  };
}

// ---------------------------------------------------------------------------
// §4 — cash deployment

export type CashRule =
  | { state: "deploy"; reasons: ("fear" | "drawdown")[]; monthlyAzn: number }
  | { state: "excess"; excessAzn: number }
  | { state: "idle" }
  | { state: "unknown" };

/**
 * Evaluate the dip-buying rule. `extremeFear` / `drawdown` are null when the
 * corresponding signal could not be fetched; with no signal at all the rule
 * reports "unknown" rather than guessing — except that cash sitting above its
 * cap is a violation regardless of the trigger (§4's last clause).
 */
export function evaluateCashRule(
  report: PolicyReport,
  signals: { extremeFear: boolean | null; drawdown: number | null },
): CashRule {
  const cash = report.sleeves.find((s) => s.sleeve === "cash");
  if (!cash) return { state: "unknown" };

  const reasons: ("fear" | "drawdown")[] = [];
  if (signals.extremeFear === true) reasons.push("fear");
  if (
    signals.drawdown != null &&
    signals.drawdown <= POLICY.cashDeployDrawdown
  )
    reasons.push("drawdown");

  if (reasons.length > 0)
    return {
      state: "deploy",
      reasons,
      monthlyAzn: cash.valueAzn * POLICY.cashDeployFraction,
    };
  if (cash.status === "over" || cash.status === "trim")
    return { state: "excess", excessAzn: cash.deltaAzn };
  if (signals.extremeFear == null && signals.drawdown == null)
    return { state: "unknown" };
  return { state: "idle" };
}
