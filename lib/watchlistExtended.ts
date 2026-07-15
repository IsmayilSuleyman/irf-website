import { google, type sheets_v4 } from "googleapis";
import { getExtendedQuotes, toYahooSymbol } from "@/lib/yahoo";

// Writes Yahoo pre/after-market data into the Watchlist tab, columns L–Q
// (the sheet's own columns end at K; the grid is expanded on first run).
// This is the app's ONLY write path into the Google Sheet — everything else
// stays read-only. Requires the service account to be an Editor on the
// spreadsheet; a permission failure is reported, not thrown.

const WATCHLIST_TAB = "Watchlist";
const HEADER_ROW = 8; // matches the existing Symbol/Price header row
const FIRST_DATA_ROW = 9;
const LAST_DATA_ROW = 40; // the tab's grid height
const NEEDED_COLUMNS = 17; // A..Q

const HEADERS = [
  "Pre-market $",
  "Pre-market %",
  "After-market $",
  "After-market %",
  "Bazar statusu",
  "Yeniləndi",
];

export type ExtendedHoursResult =
  | { ok: true; updated: number; ranAt: string }
  | { ok: false; reason: "throttled" | "not-configured" | "no-symbols" | "sheet-not-editable" | "error"; detail?: string };

function getWriteClient(): { sheets: sheets_v4.Sheets; sheetId: string } | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const sheetId = process.env.SHEET_ID;
  if (!raw || !sheetId) return null;
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(raw),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return { sheets: google.sheets({ version: "v4", auth }), sheetId };
}

// Baku-readable timestamp for the "Yeniləndi" column.
function bakuNow(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Baku",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")} Bakı`;
}

async function ensureColumns(sheets: sheets_v4.Sheets, sheetId: string): Promise<void> {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: sheetId,
    fields: "sheets(properties(sheetId,title,gridProperties(columnCount)))",
  });
  const tab = meta.data.sheets?.find((s) => s.properties?.title === WATCHLIST_TAB);
  const gid = tab?.properties?.sheetId;
  const columns = tab?.properties?.gridProperties?.columnCount ?? 0;
  if (gid == null || columns >= NEEDED_COLUMNS) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [
        {
          appendDimension: {
            sheetId: gid,
            dimension: "COLUMNS",
            length: NEEDED_COLUMNS - columns,
          },
        },
      ],
    },
  });
}

const isPermissionError = (err: unknown): boolean => {
  const e = err as { code?: number; message?: string };
  return e?.code === 403 || /permission/i.test(e?.message ?? "");
};

// Serverless instances reset this, which is fine — it only exists to stop a
// burst of dashboard renders from hammering Yahoo/Sheets.
let lastRunMs = 0;
const THROTTLE_MS = 10 * 60 * 1000;

/**
 * Fetch pre/after-market quotes for every Watchlist symbol and write them
 * into columns L–Q, row-aligned with column B. Best-effort by design.
 */
export async function refreshExtendedHours(force = false): Promise<ExtendedHoursResult> {
  if (!force && Date.now() - lastRunMs < THROTTLE_MS) {
    return { ok: false, reason: "throttled" };
  }
  lastRunMs = Date.now();

  const client = getWriteClient();
  if (!client) return { ok: false, reason: "not-configured" };
  const { sheets, sheetId } = client;

  try {
    // Raw symbol column read keeps row alignment exact (blanks stay blank).
    const symRes = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `'${WATCHLIST_TAB}'!B${FIRST_DATA_ROW}:B${LAST_DATA_ROW}`,
    });
    const symbolRows = (symRes.data.values ?? []).map((r) => String(r?.[0] ?? "").trim());
    const symbols = symbolRows.filter(Boolean);
    if (symbols.length === 0) return { ok: false, reason: "no-symbols" };

    const quotes = await getExtendedQuotes(symbols);

    const stamp = bakuNow();
    const rows: (string | number)[][] = symbolRows.map((raw) => {
      if (!raw) return ["", "", "", "", "", ""];
      const q = quotes.get(toYahooSymbol(raw));
      if (!q) return ["", "", "", "", "tapılmadı", stamp];
      return [
        q.preMarketPrice ?? "",
        q.preMarketChangePercent != null ? q.preMarketChangePercent / 100 : "",
        q.postMarketPrice ?? "",
        q.postMarketChangePercent != null ? q.postMarketChangePercent / 100 : "",
        q.marketState ?? "",
        stamp,
      ];
    });

    await ensureColumns(sheets, sheetId);

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        // Percent columns are written as fractions so İsmayıl can format
        // them as % in the sheet; USER_ENTERED keeps numbers numeric.
        valueInputOption: "USER_ENTERED",
        data: [
          { range: `'${WATCHLIST_TAB}'!L${HEADER_ROW}:Q${HEADER_ROW}`, values: [HEADERS] },
          {
            range: `'${WATCHLIST_TAB}'!L${FIRST_DATA_ROW}:Q${FIRST_DATA_ROW + rows.length - 1}`,
            values: rows,
          },
        ],
      },
    });

    return { ok: true, updated: symbols.length, ranAt: stamp };
  } catch (err) {
    if (isPermissionError(err)) {
      console.error(
        "[extended-hours] Sheet is not editable by the service account — share the spreadsheet with the service-account email as Editor.",
      );
      return { ok: false, reason: "sheet-not-editable" };
    }
    console.error("[extended-hours] refresh failed:", err);
    return { ok: false, reason: "error", detail: (err as Error)?.message };
  }
}
