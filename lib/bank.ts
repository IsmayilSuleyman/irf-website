import { google } from "googleapis";
import { unstable_cache } from "next/cache";

export type BankAccount = {
  name: string;
  depositedAzn: number;
  outstandingLoanAzn: number;
  netAzn: number;
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

function parseAzn(value: unknown): number {
  if (value == null) return 0;
  const cleaned = String(value).replace(/[₼\s,]/g, "");
  const parsed = Number(cleaned.replace(/[^\d.\-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("az-AZ").replace(/\s+/g, " ");
}

function headerKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("az-AZ")
    .replace(/[\s_\-]+/g, "");
}

const NAME_HEADERS = ["fullname", "name", "sahib", "hesabadi", "accountname"];
const DEPOSIT_HEADERS = [
  "deposited",
  "deposit",
  "emanet",
  "əmanət",
  "yatirilan",
  "yatırılan",
  "balans",
];
const LOAN_HEADERS = [
  "outstandingloan",
  "loan",
  "borc",
  "kredit",
  "qaliqborc",
  "qalıqborc",
];
const UPDATED_HEADERS = [
  "updatedat",
  "lastupdated",
  "yenilənib",
  "yenilenib",
  "tarix",
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
  fallback: number,
): number {
  if (!row) return fallback;
  const target = aliases.map((alias) => normalize(alias));
  const index = row.findIndex((cell) => target.includes(headerKey(cell)));
  return index >= 0 ? index : fallback;
}

async function parseBankAccounts(): Promise<BankAccount[]> {
  const tabName = process.env.BANK_SHEET_TAB ?? "BankAccounts";
  const range = process.env.BANK_SHEET_RANGE ?? "A1:D1000";
  const rows = await readTab(tabName, range);

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

  const out: BankAccount[] = [];
  const startRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 1;

  for (let i = startRow; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row) continue;

    const name = row[nameCol]?.toString().trim();
    if (!name) continue;

    const depositedAzn = parseAzn(row[depositedCol]);
    const outstandingLoanAzn = parseAzn(row[loanCol]);
    const updatedAt = row[updatedCol]?.toString().trim() || null;

    out.push({
      name,
      depositedAzn,
      outstandingLoanAzn,
      netAzn: depositedAzn - outstandingLoanAzn,
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
