import { google } from "googleapis";
import { unstable_cache } from "next/cache";
import type { NavPoint } from "@/lib/priceHistory";

export type Holder = {
  name: string;
  units: number;
  percent: number; // 0..1
  valueAzn: number;
};

export type FundData = {
  totalCapital: number;
  debtCapital: number;
  netCapital: number;
  totalUnits: number;
  unitPrice: number;
  holders: Holder[];
};

export type Transaction = {
  holderName: string;
  date: string;
  units: number;
  price: number;
};

export type HolderPerformance = {
  totalUnits: number;
  totalInvested: number;
  avgBuyPrice: number | null;
  currentValue: number;
  pnlAzn: number;
  pnlPct: number;
};

export type Holding = {
  symbol: string;
  name: string;
  priceUsd: number;
  avgPurchaseUsd: number | null;
  sharesHeld: number;
  costBasisAzn: number;
  valueAzn: number;
  percent: number; // 0..1 of portfolio total
  isCash: boolean;
  changePct: number | null; // null for Cash or when avg missing
  dayChangePct: number | null; // daily % change from Watchlist col G; null for Cash
  // Dollar-denominated companions to the percent changes, derived from shares
  // (col H) and daily price change (col F). Null when the underlying cells
  // are missing or zero.
  dayChangeUsd: number | null;
  totalPnlUsd: number | null;
  sector: string | null; // from Watchlist col K; Cash rows are bucketed as "Cash"
};

// Official CBAR peg
const USD_TO_AZN = 1.7;

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON env var is missing");
  const credentials = JSON.parse(raw);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

const parseAzn = (v: unknown): number => {
  if (v == null) return 0;
  const cleaned = String(v).replace(/[₼\s,]/g, "");
  const n = Number(cleaned.replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

async function readTab(tabName: string, range: string): Promise<string[][]> {
  const sheetId = process.env.SHEET_ID;
  if (!sheetId) throw new Error("SHEET_ID env var is missing");
  const sheets = google.sheets({ version: "v4", auth: getAuth() });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `'${tabName}'!${range}`,
  });
  return (res.data.values ?? []) as string[][];
}

function findRowByPrefix(rows: string[][], prefix: string): number {
  return rows.findIndex((r) =>
    r[0]?.toString().trim().toLowerCase().startsWith(prefix.toLowerCase()),
  );
}

async function parseFundData(): Promise<FundData> {
  // Fund totals come from the IRF tab — labels in col A, values in col D (index 3)
  const irfRows = await readTab("IRF", "A1:D20");

  const cellAt = (label: string) => {
    const idx = findRowByPrefix(irfRows, label);
    return idx >= 0 ? irfRows[idx]?.[3] : undefined;
  };

  const totalCapital = parseAzn(cellAt("Ümumi Kapital"));
  const debtCapital = parseAzn(cellAt("Borclu Kapital"));
  const netCapital = parseAzn(cellAt("Xalis Kapital"));
  const totalUnits = parseAzn(cellAt("Pay sayı"));
  const unitPrice = parseAzn(cellAt("1 payın qiyməti"));

  // Holders come from the Sahiblik tab — col A: name, col B: value, col C: units
  const sahiblikRows = await readTab("Sahiblik", "A1:C20");
  const holders: Holder[] = [];

  for (let i = 1; i < sahiblikRows.length; i++) { // skip header row
    const name = sahiblikRows[i]?.[0]?.toString().trim();
    if (!name) break;
    const valueAzn = parseAzn(sahiblikRows[i]?.[1]);
    const units = parseAzn(sahiblikRows[i]?.[2]);
    const percent = totalUnits > 0 ? units / totalUnits : 0;
    holders.push({ name, units, percent, valueAzn });
  }

  return { totalCapital, debtCapital, netCapital, totalUnits, unitPrice, holders };
}

export const getFundData = unstable_cache(
  async (): Promise<FundData> => parseFundData(),
  ["irf-fund-data"],
  { revalidate: 60, tags: ["sheet"] },
);

async function parseTransactions(): Promise<Transaction[]> {
  let rows: string[][];
  try {
    rows = await readTab("Transactions", "A1:D1000");
  } catch (err) {
    console.error("Transactions tab read error:", err);
    return [];
  }
  const out: Transaction[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const holderName = row[0]?.toString().trim();
    if (!holderName) continue;
    const date = row[1]?.toString().trim() ?? "";
    const units = parseAzn(row[2]);
    const price = parseAzn(row[3]);
    if (!Number.isFinite(units) || units === 0) continue;
    out.push({ holderName, date, units, price });
  }
  return out;
}

export const getTransactions = unstable_cache(
  async (): Promise<Transaction[]> => parseTransactions(),
  ["irf-transactions"],
  { revalidate: 60, tags: ["sheet"] },
);

async function parseHoldings(): Promise<Holding[]> {
  // Watchlist columns (B..K): B=Symbol, D=Stock Name, E=Price USD, I=Value USD,
  // J=Avg Purchase USD, K=Sector. Row 8 is the header; data lives at B9:K50.
  // Some tickers (e.g. IBIT, IREN) have no Google-Finance name in col D — fall
  // back to the ticker symbol so rows are never silently dropped.
  let rows: string[][];
  try {
    rows = await readTab("Watchlist", "B9:K50");
  } catch (err) {
    console.error("Watchlist tab read error:", err);
    return [];
  }

  const raw: Holding[] = [];
  for (const row of rows) {
    if (!row) continue;
    const symbol = row[0]?.toString().trim() ?? "";
    const name = row[2]?.toString().trim() ?? "";
    if (!symbol && !name) continue;
    const priceUsd = parseAzn(row[3]);
    const dayPriceDeltaUsd = parseAzn(row[4]); // col F: daily $ price move
    const dayChangeRaw = row[5]?.toString().trim() ?? "";
    const sharesHeld = parseAzn(row[6]); // col H
    const valueUsd = parseAzn(row[7]);
    const avgPurchaseUsd = parseAzn(row[8]);
    const sectorRaw = row[9]?.toString().trim() ?? "";
    const isCash =
      /^cash$/i.test(symbol) || /cash/i.test(name) || /nağd/i.test(name);
    const valueAzn = valueUsd * USD_TO_AZN;
    if (valueAzn <= 0 && !isCash) continue;
    const changePct =
      isCash || !avgPurchaseUsd
        ? null
        : (priceUsd - avgPurchaseUsd) / avgPurchaseUsd;
    // Col G may be formatted as "2.3%" or a raw number like 2.3 (percent form).
    const hasPercentSign = /%/.test(dayChangeRaw);
    const dayChangeNum = Number(dayChangeRaw.replace(/[^\d.\-]/g, ""));
    const dayChangePct =
      isCash || !dayChangeRaw || !Number.isFinite(dayChangeNum)
        ? null
        : hasPercentSign || Math.abs(dayChangeNum) > 1
          ? dayChangeNum / 100
          : dayChangeNum;
    const sector = isCash ? "Nağd pul" : sectorRaw || null;
    const dayChangeUsd =
      isCash || !sharesHeld || !Number.isFinite(dayPriceDeltaUsd)
        ? null
        : dayPriceDeltaUsd * sharesHeld * USD_TO_AZN;
    const totalPnlUsd =
      isCash || !avgPurchaseUsd || !sharesHeld
        ? null
        : (priceUsd - avgPurchaseUsd) * sharesHeld * USD_TO_AZN;
    const costBasisAzn =
      isCash || !avgPurchaseUsd || !sharesHeld
        ? 0
        : avgPurchaseUsd * sharesHeld * USD_TO_AZN;
    raw.push({
      symbol,
      name: name || symbol,
      priceUsd,
      avgPurchaseUsd: avgPurchaseUsd || null,
      sharesHeld,
      costBasisAzn,
      valueAzn,
      percent: 0,
      isCash,
      changePct,
      dayChangePct,
      dayChangeUsd,
      totalPnlUsd,
      sector,
    });
  }
  const total = raw.reduce((s, h) => s + h.valueAzn, 0);
  const withPct = raw.map((h) => ({
    ...h,
    percent: total > 0 ? h.valueAzn / total : 0,
  }));
  withPct.sort((a, b) => b.valueAzn - a.valueAzn);
  return withPct;
}

export const getHoldings = unstable_cache(
  async (): Promise<Holding[]> => parseHoldings(),
  ["irf-holdings"],
  { revalidate: 60, tags: ["sheet"] },
);

export type Debt = {
  name: string;
  originalAzn: number;
  remainingAzn: number;
  monthlyPaymentAzn: number;
  annualInterestRate: number; // 0..1, e.g. 0.12 for 12%
};

async function parseDebts(): Promise<Debt[]> {
  let rows: string[][];
  try {
    rows = await readTab("Debts", "A2:E50");
  } catch (err) {
    console.error("Debts tab read error:", err);
    return [];
  }
  const out: Debt[] = [];
  for (const row of rows) {
    const name = row[0]?.toString().trim();
    if (!name) continue;
    const originalAzn = parseAzn(row[1]);
    const remainingAzn = parseAzn(row[2]);
    const monthlyPaymentAzn = parseAzn(row[3]);
    const annualInterestRate = parseAzn(row[4]) / 100;
    out.push({ name, originalAzn, remainingAzn, monthlyPaymentAzn, annualInterestRate });
  }
  return out;
}

export const getDebts = unstable_cache(
  async (): Promise<Debt[]> => parseDebts(),
  ["irf-debts"],
  { revalidate: 60, tags: ["sheet"] },
);

const norm = (s: string) =>
  s.trim().toLocaleLowerCase("az-AZ").replace(/\s+/g, " ");

export async function getHolderByName(
  name: string | undefined | null,
): Promise<Holder | undefined> {
  if (!name) return undefined;
  const data = await getFundData();
  const target = norm(name);
  return data.holders.find((h) => norm(h.name) === target);
}

export function computeHolderPerformance(
  holderName: string,
  transactions: Transaction[],
  currentPrice: number,
  currentUnits: number,
): HolderPerformance {
  const target = norm(holderName);
  const mine = transactions.filter((t) => norm(t.holderName) === target);

  let buyUnits = 0;
  let totalInvested = 0;
  for (const t of mine) {
    if (t.units > 0) {
      buyUnits += t.units;
      totalInvested += t.units * t.price;
    }
  }

  const avgBuyPrice = buyUnits > 0 ? totalInvested / buyUnits : null;
  const currentValue = currentUnits * currentPrice;
  // Cost basis attributable to currently-held units (assumes FIFO/avg-cost)
  const costBasisOfHeld = avgBuyPrice != null ? avgBuyPrice * currentUnits : 0;
  const pnlAzn = avgBuyPrice != null ? currentValue - costBasisOfHeld : 0;
  const pnlPct = costBasisOfHeld > 0 ? pnlAzn / costBasisOfHeld : 0;

  return {
    totalUnits: currentUnits,
    totalInvested,
    avgBuyPrice,
    currentValue,
    pnlAzn,
    pnlPct,
  };
}

/**
 * Builds a per-user holding-value time series by combining price history with
 * the user's transaction history.
 *
 * At each price-history point T:
 *   value_T = Σ(units from transactions on or before T) × unit_price_T
 *
 * Points before the user's first transaction are excluded so the chart starts
 * from when they first held units.
 */
export function computeHolderValueHistory(
  holderName: string,
  transactions: Transaction[],
  priceHistory: NavPoint[],
): { label: string; value: number }[] {
  const target = norm(holderName);
  const mine = transactions.filter((t) => norm(t.holderName) === target);

  if (mine.length === 0) return [];

  // Earliest transaction date (ms) — chart starts here
  const firstTxMs = Math.min(
    ...mine
      .map((t) => new Date(t.date).getTime())
      .filter((n) => Number.isFinite(n)),
  );

  const result: { label: string; value: number }[] = [];

  for (const point of priceHistory) {
    const pointMs = new Date(point.recordedAt).getTime();
    if (!Number.isFinite(pointMs) || pointMs < firstTxMs) continue;

    // Units held by this user at this point in time
    let units = 0;
    for (const t of mine) {
      const tMs = new Date(t.date).getTime();
      if (Number.isFinite(tMs) && tMs <= pointMs) {
        units += t.units;
      }
    }

    if (units > 0) {
      result.push({ label: point.label, value: units * point.price });
    }
  }

  return result;
}

/**
 * Transaction-aware holding-value change over a period.
 *
 * Computes how much the user's holding actually gained or lost over the
 * window, netting out cash flows so that fresh buys don't masquerade as gains
 * and sells don't masquerade as losses.
 *
 *   delta = (currentValue + cashOutFromSells) − (pastValue + cashInFromBuys)
 *
 * Where:
 *   currentValue = currentUnits × currentPrice
 *   pastValue    = unitsAtPastDate × pastPrice
 *   unitsAtPastDate = currentUnits − Σ(t.units) over transactions in (pastDate, now]
 *
 * Returns null if no past price is available.
 */
export function computeHoldingDeltaSince(
  holderName: string,
  transactions: Transaction[],
  currentUnits: number,
  currentPrice: number,
  pastPrice: number | null,
  pastDate: Date,
): number | null {
  if (pastPrice == null) return null;

  const target = norm(holderName);
  const pastMs = pastDate.getTime();
  const mineInWindow = transactions.filter((t) => {
    if (norm(t.holderName) !== target) return false;
    const ts = new Date(t.date).getTime();
    return Number.isFinite(ts) && ts > pastMs;
  });

  let netUnitsInWindow = 0;
  let cashIn = 0; // cash spent on buys in the window
  let cashOut = 0; // cash received from sells in the window
  for (const t of mineInWindow) {
    netUnitsInWindow += t.units;
    if (t.units > 0) cashIn += t.units * t.price;
    else cashOut += -t.units * t.price;
  }

  const unitsAtPastDate = currentUnits - netUnitsInWindow;
  const pastValue = unitsAtPastDate * pastPrice;
  const currentValue = currentUnits * currentPrice;

  return currentValue + cashOut - (pastValue + cashIn);
}
