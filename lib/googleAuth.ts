import { auth as googleAuth } from "@googleapis/sheets";

type GoogleAuthClient = InstanceType<typeof googleAuth.GoogleAuth>;

let readAuth: GoogleAuthClient | null = null;

/**
 * The service account's read-only Sheets auth, built once per server
 * instance. A GoogleAuth keeps its OAuth access token (~1h) and refreshes
 * it itself; the old per-read `new GoogleAuth()` threw that away, so every
 * cache-miss Sheet read first paid a token exchange with
 * oauth2.googleapis.com before the read itself could start. Shared by the
 * fund snapshot, the Aktivlər ledger and the bank sheet.
 */
export function getSheetsReadAuth(): GoogleAuthClient {
  if (readAuth) return readAuth;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON env var is missing");
  readAuth = new googleAuth.GoogleAuth({
    credentials: JSON.parse(raw),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return readAuth;
}
