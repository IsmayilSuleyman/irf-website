import { google } from "googleapis";
import { unstable_cache } from "next/cache";

export type BankPaymentScheduleItem = {
  amountAzn: number | null;
  date: string;
  label: string | null;
  status: string | null;
};

export type BankAccount = {
  annualRatePct: number | null;
  depositedAzn: number;
  maturityBonusAzn: number | null;
  maturityDate: string | null;
  monthlyPaymentAzn: number | null;
  name: string;
  netAzn: number;
  nextPaymentDate: string | null;
  outstandingLoanAzn: number;
  paymentSchedule: BankPaymentScheduleItem[];
  termMonths: number | null;
  updatedAt: string | null;
};

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON env var is missing");

  const credentials = JSON.parse(raw);

  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("az-AZ").replace(/\s+/g, " ");
}

export function simplifyText(value: string): string {
  return value
    .replace(/[\u018F\u0259]/g, "e")
    .replace(/[\u0049\u0130\u0131\u0069]/g, "i")
    .replace(/[\u00D6\u00F6]/g, "o")
    .replace(/[\u00DC\u00FC]/g, "u")
    .replace(/[\u011E\u011F]/g, "g")
    .replace(/[\u015E\u015F]/g, "s")
    .replace(/[\u00C7\u00E7]/g, "c");
}

function headerKey(value: unknown): string {
  return simplifyText(String(value ?? ""))
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/%/g, "pct")
    .replace(/[().:]/g, "")
    .replace(/[\s_\-]+/g, "");
}

function parseNumeric(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  let cleaned = String(value)
    .trim()
    .replace(/\u00A0/g, " ")
    .replace(/AZN/gi, "")
    .replace(/[\u20BC$\u20AC\u00A3]/g, "")
    .replace(/\s+/g, "");

  if (!cleaned) return null;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (lastComma >= 0) {
    const fractionLength = cleaned.length - lastComma - 1;
    cleaned =
      fractionLength > 0 && fractionLength <= 2
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else {
    const dotCount = cleaned.match(/\./g)?.length ?? 0;
    if (dotCount > 1) {
      const index = cleaned.lastIndexOf(".");
      cleaned =
        cleaned.slice(0, index).replace(/\./g, "") + "." + cleaned.slice(index + 1);
    }
  }

  cleaned = cleaned.replace(/[^\d.-]/g, "");

  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === "-.") {
    return null;
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseAzn(value: unknown): number {
  return parseNumeric(value) ?? 0;
}

function parsePercent(value: unknown): number | null {
  const parsed = parseNumeric(value);
  if (parsed == null) return null;

  const raw = String(value ?? "");
  if (raw.includes("%")) return parsed;

  return parsed > 0 && parsed <= 1 ? parsed * 100 : parsed;
}

function parseWholeNumber(value: unknown): number | null {
  const parsed = parseNumeric(value);
  return parsed == null ? null : Math.round(parsed);
}

function parseText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function parseScheduleObject(raw: unknown): BankPaymentScheduleItem | null {
  if (!raw || typeof raw !== "object") return null;

  const candidate = raw as Record<string, unknown>;
  const date = parseText(candidate.date ?? candidate.tarix ?? candidate.dueDate);
  if (!date) return null;

  return {
    amountAzn: parseNumeric(candidate.amountAzn ?? candidate.amount ?? candidate.mebleg),
    date,
    label: parseText(candidate.label ?? candidate.title ?? candidate.note),
    status: parseText(candidate.status ?? candidate.state),
  };
}

function parsePaymentSchedule(value: unknown): BankPaymentScheduleItem[] {
  const raw = parseText(value);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => parseScheduleObject(item))
        .filter((item): item is BankPaymentScheduleItem => item != null);
    }
  } catch {
    // Fall through to the lightweight delimiter-based parser below.
  }

  return raw
    .split(/[\n;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [date, amount, status, label] = entry.split("|").map((part) => part.trim());
      if (!date) return null;

      return {
        amountAzn: parseNumeric(amount),
        date,
        label: label || null,
        status: status || null,
      };
    })
    .filter((item): item is BankPaymentScheduleItem => item != null);
}

const NAME_HEADERS = ["fullname", "name", "sahib", "hesabadi", "accountname"];
const DEPOSIT_HEADERS = [
  "deposited",
  "deposit",
  "depositedazn",
  "depositazn",
  "emanet",
  "yatirilan",
  "balans",
];
const LOAN_HEADERS = [
  "outstandingloan",
  "outstandingloanazn",
  "loan",
  "loanazn",
  "borc",
  "kredit",
  "qaliqborc",
  "qaliqkredit",
];
const UPDATED_HEADERS = [
  "updatedat",
  "lastupdated",
  "yenilenib",
  "yenilenmetarixi",
  "yenilenmeler",
  "tarix",
];
const RATE_HEADERS = [
  "annualratepct",
  "annualrate",
  "interestratepct",
  "interestpct",
  "ratepct",
  "rate",
  "faiz",
  "illikfaiz",
  "faizderecesi",
];
const TERM_HEADERS = [
  "termmonths",
  "termmonth",
  "months",
  "month",
  "muddet",
  "muddetay",
];
const BONUS_HEADERS = [
  "maturitybonusazn",
  "maturitybonus",
  "bonusazn",
  "bonus",
  "elavemebleg",
  "sonudelave",
];
const MATURITY_DATE_HEADERS = [
  "maturitydate",
  "depositmaturitydate",
  "yetismetarixi",
  "bitmetarixi",
];
const MONTHLY_PAYMENT_HEADERS = [
  "monthlypaymentazn",
  "monthlypayment",
  "installmentazn",
  "installment",
  "ayliqodenis",
  "odenis",
];
const NEXT_PAYMENT_DATE_HEADERS = [
  "nextpaymentdate",
  "upcomingpaymentdate",
  "novbetiodenistarixi",
  "odenistarixi",
];
const PAYMENT_SCHEDULE_HEADERS = [
  "paymentschedule",
  "paymentplan",
  "schedule",
  "odeniscedveli",
  "cedvel",
];

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

function findColumn(
  row: string[] | undefined,
  aliases: string[],
  fallback: number | null = null,
): number | null {
  if (!row) return fallback;

  const targets = aliases.map((alias) => headerKey(alias));
  const index = row.findIndex((cell) => targets.includes(headerKey(cell)));

  return index >= 0 ? index : fallback;
}

async function parseBankAccounts(): Promise<BankAccount[]> {
  const tabName = process.env.BANK_SHEET_TAB ?? "BankAccounts";
  const range = process.env.BANK_SHEET_RANGE ?? "A1:Z1000";

  let rows: string[][];
  try {
    rows = await readTab(tabName, range);
  } catch (err) {
    console.error("[bank] Google Sheets fetch failed:", err);
    return [];
  }

  if (rows.length === 0) {
    return [];
  }

  const headerRowIndex = rows.findIndex((row) => {
    const keys = row.map((cell) => headerKey(cell));
    return (
      keys.some((key) => NAME_HEADERS.includes(key)) &&
      keys.some((key) => DEPOSIT_HEADERS.includes(key))
    );
  });

  const headerRow = headerRowIndex >= 0 ? rows[headerRowIndex] : rows[0];
  const nameCol = findColumn(headerRow, NAME_HEADERS, 0);
  const depositedCol = findColumn(headerRow, DEPOSIT_HEADERS, 1);
  const loanCol = findColumn(headerRow, LOAN_HEADERS, 2);
  const updatedCol = findColumn(headerRow, UPDATED_HEADERS, 3);
  const rateCol = findColumn(headerRow, RATE_HEADERS);
  const termCol = findColumn(headerRow, TERM_HEADERS);
  const bonusCol = findColumn(headerRow, BONUS_HEADERS);
  const maturityDateCol = findColumn(headerRow, MATURITY_DATE_HEADERS);
  const monthlyPaymentCol = findColumn(headerRow, MONTHLY_PAYMENT_HEADERS);
  const nextPaymentDateCol = findColumn(headerRow, NEXT_PAYMENT_DATE_HEADERS);
  const paymentScheduleCol = findColumn(headerRow, PAYMENT_SCHEDULE_HEADERS);

  const out: BankAccount[] = [];
  const startRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 1;

  for (let i = startRow; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row) continue;

    const name = row[nameCol ?? 0]?.toString().trim();
    if (!name) continue;

    const depositedAzn = parseAzn(row[depositedCol ?? 1]);
    const outstandingLoanAzn = parseAzn(row[loanCol ?? 2]);
    const updatedAt =
      updatedCol == null ? null : row[updatedCol]?.toString().trim() || null;

    out.push({
      annualRatePct: rateCol == null ? null : parsePercent(row[rateCol]),
      depositedAzn,
      maturityBonusAzn: bonusCol == null ? null : parseNumeric(row[bonusCol]),
      maturityDate: maturityDateCol == null ? null : parseText(row[maturityDateCol]),
      monthlyPaymentAzn:
        monthlyPaymentCol == null ? null : parseNumeric(row[monthlyPaymentCol]),
      name,
      netAzn: depositedAzn - outstandingLoanAzn,
      nextPaymentDate:
        nextPaymentDateCol == null ? null : parseText(row[nextPaymentDateCol]),
      outstandingLoanAzn,
      paymentSchedule:
        paymentScheduleCol == null ? [] : parsePaymentSchedule(row[paymentScheduleCol]),
      termMonths: termCol == null ? null : parseWholeNumber(row[termCol]),
      updatedAt,
    });
  }

  return out;
}

export const getBankAccounts = unstable_cache(
  async (): Promise<BankAccount[]> => parseBankAccounts(),
  ["ismayilbank-accounts"],
  { revalidate: 60, tags: ["bank-sheet"] },
);

export async function getBankAccountByName(
  name: string | undefined | null,
): Promise<BankAccount | undefined> {
  if (!name) return undefined;

  const accounts = await getBankAccounts();
  const target = normalize(name);

  return accounts.find((account) => normalize(account.name) === target);
}
