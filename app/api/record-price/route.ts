import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";

export const runtime = "nodejs";

function getSheetAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON missing");
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(raw),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

async function getCurrentUnitPrice(): Promise<number> {
  const sheets = google.sheets({ version: "v4", auth: getSheetAuth() });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID!,
    range: "IRF!D14",
  });
  const raw = res.data.values?.[0]?.[0] ?? "0";
  return Number(String(raw).replace(/[^\d.]/g, ""));
}

export async function GET(req: Request) {
  // Protect the endpoint with CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const price = await getCurrentUnitPrice();
    const now = new Date();

    // Date string for uniqueness constraint e.g. "2026-04-11"
    const recorded_at = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Baku",
    });

    // Human label e.g. "11 Apr 26"
    const label = now.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
      timeZone: "Asia/Baku",
    });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const { error } = await supabase
      .from("price_history")
      .upsert({ label, price, recorded_at }, { onConflict: "recorded_at" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, price, label, recorded_at });
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 },
    );
  }
}
