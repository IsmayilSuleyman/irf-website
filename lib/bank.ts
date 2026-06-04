import { google } from "googleapis";
import { unstable_cache } from "next/cache";
import { formatAzn } from "@/lib/portfolio";

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

// A schedule installment counts as paid only when its status exactly matches one
// of Ismayil's paid words ("Odenildi" / "Odenilmisdir" / "Odendi" / "Odenmis",
// compared after simplifyText folds the diacritics). Deliberately stricter than
// a substring check: an unpaid status such as "Odenilecek" also contains the
// "oden" root, so a substring test would silently drop its reminder.
const PAID_STATUS_TOKENS = new Set(["odenildi", "odenilmisdir", "odendi", "odenmis"]);

export function isPaymentPaid(status: string | null | undefined): boolean {
  const token = simplifyText(String(status ?? "")).trim().toLocaleLowerCase("en-US");
  return PAID_STATUS_TOKENS.has(token);
}

const AZ_MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr",
];

// Azerbaijani-aware case maps. Node's "az" locale is unreliable (same reason
// lib/portfolio formats AZN manually), so the İ/I/ı/i + Əə… cases are explicit.
const AZ_TO_LOWER: Record<string, string> = {
  I: "ı", "İ": "i", "Ə": "ə", "Ö": "ö", "Ü": "ü", "Ğ": "ğ", "Ş": "ş", "Ç": "ç",
};
const AZ_TO_UPPER: Record<string, string> = {
  "ı": "I", i: "İ", "ə": "Ə", "ö": "Ö", "ü": "Ü", "ğ": "Ğ", "ş": "Ş", "ç": "Ç",
};

function azLower(s: string): string {
  return s.replace(/[A-ZÇĞİÖŞÜƏ]/g, (c) => AZ_TO_LOWER[c] ?? c.toLowerCase());
}

function azUpperFirst(s: string): string {
  if (!s) return s;
  const first = s.charAt(0);
  return (AZ_TO_UPPER[first] ?? first.toUpperCase()) + s.slice(1);
}

// "İSMAYIL SÜLEYMAN" -> "İsmayıl Süleyman"
export function azTitleCase(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => azUpperFirst(azLower(w)))
    .join(" ");
}

// The borrower-facing reminder/notice text, shared by the daily cron and the
// admin "pay your debt" button so both read identically. Returns null if the
// due date isn't a parseable YYYY-MM-DD.
export function composeDebtReminderMessage(
  rawHolderName: string,
  item: Pick<BankPaymentScheduleItem, "date" | "amountAzn">,
): { title: string; body: string } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(item.date.trim());
  if (!m) return null;
  const monthLower = AZ_MONTHS[Number(m[2]) - 1];
  if (!monthLower) return null;
  const monthCap = azUpperFirst(monthLower);
  const day = Number(m[3]); // strips any leading zero: "03" -> 3
  const name = azTitleCase(rawHolderName);
  const amount = item.amountAzn != null ? `${formatAzn(item.amountAzn)} ` : "";

  return {
    title: "Ödəniş xatırlatması",
    body:
      `Dəyərli ${name}, sizin ${monthLower} ayı üçün ${amount}ödənişiniz var. ` +
      `${monthCap} ayı üçün ödənişinizi ayın ${day}-dək etmənizi xahiş edirik.`,
  };
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

// === Bank-wide aggregation for the "Ümumbank baxış" toggle ===
//
// Pure function over the parsed BankAccount[]. Caller passes `today` so we can
// snapshot the 30-day windows deterministically (and test without freezing
// clock time). Date math uses UTC midnight throughout — accuracy is "days",
// not "minutes", so we sidestep DST / Baku tz drift entirely.

export type BankWideDepositor = {
  name: string;
  depositedAzn: number;
  maturityDate: string | null;
  maturityBonusAzn: number | null;
  daysToMaturity: number | null;
  termMonths: number | null;
  annualRatePct: number | null;
  // Monthly interest accrual (display-only; lifetime bonus is still paid at
  // maturity per the existing policy).
  monthlyInterestAzn: number;
  monthsElapsed: number;
  accruedInterestAzn: number;
};

export type BankWideBorrower = {
  name: string;
  outstandingLoanAzn: number;
  monthlyPaymentAzn: number | null;
  nextPaymentDate: string | null;
  daysToNextPayment: number | null;
};

export type BankWideUpcomingPayout = {
  name: string;
  amountAzn: number;
  date: string;
  daysAway: number;
};

export type BankWideUpcomingInflow = {
  name: string;
  amountAzn: number;
  date: string;
  daysAway: number;
  label: string | null;
  paid: boolean;
};

export type BankWideAggregate = {
  totalDepositsAzn: number;
  totalLoansAzn: number;
  netLiquidityAzn: number;
  liquidityPct: number | null;
  loanShareOfDepositsPct: number;
  totalPendingBonusAzn: number;
  // Interest the depositors have already "earned" so far, summed across all
  // open deposits (display-only). Plus the current monthly accrual rate
  // counting only deposits still within their term.
  totalAccruedInterestAzn: number;
  totalMonthlyInterestAzn: number;
  depositors: BankWideDepositor[];
  borrowers: BankWideBorrower[];
  next30dPayouts: { totalAzn: number; items: BankWideUpcomingPayout[] };
  next30dInflow: { totalAzn: number; items: BankWideUpcomingInflow[] };
};

function parseDateUtc(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // "YYYY-MM-DD" parsed as local time would shift across timezones; pin to UTC.
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? `${trimmed}T00:00:00Z` : trimmed;
  const d = new Date(iso);
  return Number.isFinite(d.valueOf()) ? d : null;
}

function daysBetween(from: Date, to: Date): number {
  const MS_PER_DAY = 86_400_000;
  return Math.round((to.valueOf() - from.valueOf()) / MS_PER_DAY);
}

// Subtract `months` months from a UTC date, preserving the day-of-month and
// clamping to the target month's end (e.g. Mar 31 minus 1 month → Feb 28/29).
function subtractMonths(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  const targetMonthStart = new Date(Date.UTC(y, m - months, 1));
  const ty = targetMonthStart.getUTCFullYear();
  const tm = targetMonthStart.getUTCMonth();
  // Last day of the target month.
  const daysInTargetMonth = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return new Date(Date.UTC(ty, tm, Math.min(d, daysInTargetMonth)));
}

// Whole calendar months elapsed from `start` to `today`. The current month
// only counts once today.day >= start.day; otherwise it's still in progress.
// Negative results are clamped to 0 (deposit hasn't started yet).
function monthsBetween(start: Date, today: Date): number {
  let months =
    (today.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (today.getUTCMonth() - start.getUTCMonth());
  if (today.getUTCDate() < start.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

export function computeBankWide(
  accounts: BankAccount[],
  today: Date,
): BankWideAggregate {
  // Anchor "today" at UTC midnight — diffs are then stable regardless of when
  // in the day the request hits.
  const todayUtc = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );

  let totalDepositsAzn = 0;
  let totalLoansAzn = 0;
  let totalPendingBonusAzn = 0;
  let totalAccruedInterestAzn = 0;
  let totalMonthlyInterestAzn = 0;

  const depositors: BankWideDepositor[] = [];
  const borrowers: BankWideBorrower[] = [];
  const payouts: BankWideUpcomingPayout[] = [];
  const inflow: BankWideUpcomingInflow[] = [];

  for (const acc of accounts) {
    totalDepositsAzn += acc.depositedAzn;
    totalLoansAzn += acc.outstandingLoanAzn;
    if (acc.maturityBonusAzn != null) totalPendingBonusAzn += acc.maturityBonusAzn;

    if (acc.depositedAzn > 0) {
      const matDate = parseDateUtc(acc.maturityDate);
      const daysToMaturity = matDate ? daysBetween(todayUtc, matDate) : null;

      // Monthly accrual (display-only). Prefer the sheet's maturityBonusAzn /
      // termMonths since the bonus column is the canonical lifetime amount.
      // Fall back to rate × principal / 12 when bonus is missing.
      let monthlyInterestAzn = 0;
      let monthsElapsed = 0;
      let accruedInterestAzn = 0;
      if (acc.termMonths != null && acc.termMonths > 0) {
        if (acc.maturityBonusAzn != null && acc.maturityBonusAzn > 0) {
          monthlyInterestAzn = acc.maturityBonusAzn / acc.termMonths;
        } else if (acc.annualRatePct != null && acc.depositedAzn > 0) {
          monthlyInterestAzn =
            (acc.depositedAzn * acc.annualRatePct) / 100 / 12;
        }
        if (monthlyInterestAzn > 0 && matDate) {
          const startDate = subtractMonths(matDate, acc.termMonths);
          monthsElapsed = Math.min(
            monthsBetween(startDate, todayUtc),
            acc.termMonths,
          );
          accruedInterestAzn = monthsElapsed * monthlyInterestAzn;
        }
      }

      totalAccruedInterestAzn += accruedInterestAzn;
      // The current monthly accrual rate only counts deposits still within
      // their term — a matured deposit no longer earns more.
      if (
        monthlyInterestAzn > 0 &&
        (acc.termMonths == null || monthsElapsed < acc.termMonths)
      ) {
        totalMonthlyInterestAzn += monthlyInterestAzn;
      }

      depositors.push({
        name: acc.name,
        depositedAzn: acc.depositedAzn,
        maturityDate: acc.maturityDate,
        maturityBonusAzn: acc.maturityBonusAzn,
        daysToMaturity,
        termMonths: acc.termMonths,
        annualRatePct: acc.annualRatePct,
        monthlyInterestAzn,
        monthsElapsed,
        accruedInterestAzn,
      });

      // Bonus paid out when the term ends — only flag the ones inside the window.
      if (
        daysToMaturity != null &&
        daysToMaturity >= 0 &&
        daysToMaturity <= 30 &&
        acc.maturityBonusAzn != null &&
        acc.maturityBonusAzn > 0 &&
        acc.maturityDate
      ) {
        payouts.push({
          name: acc.name,
          amountAzn: acc.maturityBonusAzn,
          date: acc.maturityDate,
          daysAway: daysToMaturity,
        });
      }
    }

    if (acc.outstandingLoanAzn > 0) {
      const nextDate = parseDateUtc(acc.nextPaymentDate);
      borrowers.push({
        name: acc.name,
        outstandingLoanAzn: acc.outstandingLoanAzn,
        monthlyPaymentAzn: acc.monthlyPaymentAzn,
        nextPaymentDate: acc.nextPaymentDate,
        daysToNextPayment: nextDate ? daysBetween(todayUtc, nextDate) : null,
      });

      // Window per-item:
      //   • paid installments dated within the last 30 days → surface as
      //     "Ödənilib" so a borrower who already paid this month still shows
      //     up in the card (and the row makes clear the total is 0 because
      //     it's been paid, not because the payment was forgotten).
      //   • unpaid installments dated within the next 30 days → expected
      //     inflow that does count toward the total.
      // The total only sums the unpaid bucket.
      let scheduleSeen = false;
      for (const item of acc.paymentSchedule) {
        scheduleSeen = true;
        if (item.amountAzn == null || item.amountAzn <= 0) continue;
        const d = parseDateUtc(item.date);
        if (!d) continue;
        const daysAway = daysBetween(todayUtc, d);
        const paid = isPaymentPaid(item.status);
        const inWindow = paid
          ? daysAway >= -30 && daysAway <= 30
          : daysAway >= 0 && daysAway <= 30;
        if (!inWindow) continue;
        inflow.push({
          name: acc.name,
          amountAzn: item.amountAzn,
          date: item.date,
          daysAway,
          label: item.label,
          paid,
        });
      }

      // Fallback ONLY when there are no paymentSchedule rows at all. When a
      // schedule exists, trust it as the source of truth — the fallback would
      // otherwise resurrect a paid installment as unpaid inflow (the sheet's
      // nextPaymentDate column can lag behind paid status).
      if (
        !scheduleSeen &&
        acc.nextPaymentDate &&
        acc.monthlyPaymentAzn != null &&
        acc.monthlyPaymentAzn > 0
      ) {
        const nextD = parseDateUtc(acc.nextPaymentDate);
        if (nextD) {
          const daysAway = daysBetween(todayUtc, nextD);
          if (daysAway >= 0 && daysAway <= 30) {
            inflow.push({
              name: acc.name,
              amountAzn: acc.monthlyPaymentAzn,
              date: acc.nextPaymentDate,
              daysAway,
              label: null,
              paid: false,
            });
          }
        }
      }
    }
  }

  depositors.sort((a, b) => b.depositedAzn - a.depositedAzn);
  borrowers.sort((a, b) => b.outstandingLoanAzn - a.outstandingLoanAzn);
  payouts.sort((a, b) => a.daysAway - b.daysAway);
  inflow.sort((a, b) => a.daysAway - b.daysAway);

  const netLiquidityAzn = totalDepositsAzn - totalLoansAzn;
  const liquidityPct =
    totalDepositsAzn > 0 ? (netLiquidityAzn / totalDepositsAzn) * 100 : null;
  const loanShareOfDepositsPct =
    totalDepositsAzn > 0
      ? Math.min((totalLoansAzn / totalDepositsAzn) * 100, 100)
      : 0;

  return {
    totalDepositsAzn,
    totalLoansAzn,
    netLiquidityAzn,
    liquidityPct,
    loanShareOfDepositsPct,
    totalPendingBonusAzn,
    totalAccruedInterestAzn,
    totalMonthlyInterestAzn,
    depositors,
    borrowers,
    next30dPayouts: {
      totalAzn: payouts.reduce((s, p) => s + p.amountAzn, 0),
      items: payouts,
    },
    next30dInflow: {
      // Only unpaid installments count toward the expected total.
      totalAzn: inflow.reduce((s, p) => s + (p.paid ? 0 : p.amountAzn), 0),
      items: inflow,
    },
  };
}
