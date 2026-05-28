import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getBankAccounts,
  isPaymentPaid,
  type BankPaymentScheduleItem,
} from "@/lib/bank";
import { formatAzn } from "@/lib/portfolio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Bucket = "7d" | "1d" | "overdue";

// Today's calendar date in Asia/Baku as "YYYY-MM-DD" (en-CA yields ISO order).
function bakuTodayISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Baku" });
}

// Parse a "YYYY-MM-DD" date to UTC-midnight ms. Both due dates and "today" are
// pinned to UTC midnight so the day difference is a clean calendar-day count,
// free of timezone/DST drift.
function isoToUtcMs(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function daysUntil(dueISO: string, todayISO: string): number | null {
  const due = isoToUtcMs(dueISO);
  const today = isoToUtcMs(todayISO);
  if (due == null || today == null) return null;
  return Math.round((due - today) / 86_400_000);
}

function bucketFor(days: number): Bucket | null {
  if (days === 7) return "7d";
  if (days === 1) return "1d";
  if (days <= 0) return "overdue"; // due today or already past
  return null;
}

// "2026-06-15" -> "15.06.2026" (Azerbaijani day-first display).
function humanDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

function composeMessage(
  bucket: Bucket,
  item: BankPaymentScheduleItem,
): { title: string; body: string } {
  const when = humanDate(item.date);
  const amount = item.amountAzn != null ? formatAzn(item.amountAzn) : null;
  const note = item.label ? ` ${item.label}.` : "";

  if (bucket === "7d") {
    return {
      title: "Ödənişə 1 həftə qalır",
      body: amount
        ? `${when} tarixində ${amount} ödənişiniz var.${note}`
        : `${when} tarixində ödənişiniz var.${note}`,
    };
  }
  if (bucket === "1d") {
    return {
      title: "Ödənişə 1 gün qalır",
      body: amount
        ? `Sabah (${when}) ${amount} ödənişiniz var.${note}`
        : `Sabah (${when}) ödənişiniz var.${note}`,
    };
  }
  return {
    title: "Ödəniş gecikib",
    body: amount
      ? `${when} tarixli ${amount} ödənişiniz hələ edilməyib.${note}`
      : `${when} tarixli ödənişiniz hələ edilməyib.${note}`,
  };
}

function dedupeSuffix(bucket: Bucket, dueISO: string, todayISO: string): string {
  // 7d/1d fire once per due date. Overdue re-fires once per day until paid, so
  // the run date is part of its key.
  return bucket === "overdue"
    ? `pay:${dueISO}:overdue:${todayISO}`
    : `pay:${dueISO}:${bucket}`;
}

export async function GET(req: Request) {
  // Same Bearer guard as /api/record-price.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.PAYMENT_REMINDER_SECRET;

  if (!url || !anon) {
    return NextResponse.json(
      { error: "Supabase environment variables are not configured." },
      { status: 503 },
    );
  }
  if (!secret) {
    return NextResponse.json(
      { error: "PAYMENT_REMINDER_SECRET is not configured." },
      { status: 503 },
    );
  }

  let accounts;
  try {
    accounts = await getBankAccounts();
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }

  const todayISO = bakuTodayISO();
  const supabase = createClient(url, anon);

  // ?dryRun=1 runs the full pipeline (live Sheet read + bucketing + message
  // composition) but skips every write — used to preview what would be sent.
  const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";
  const preview: Array<{
    name: string;
    date: string;
    bucket: Bucket;
    title: string;
    body: string;
  }> = [];
  let attempted = 0;
  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const account of accounts) {
    for (const item of account.paymentSchedule) {
      if (isPaymentPaid(item.status)) continue;

      const days = daysUntil(item.date, todayISO);
      if (days == null) continue; // unparseable date — leave it alone

      const bucket = bucketFor(days);
      if (!bucket) continue;

      const { title, body } = composeMessage(bucket, item);
      attempted += 1;

      if (dryRun) {
        preview.push({ name: account.name, date: item.date, bucket, title, body });
        continue;
      }

      const { data, error } = await supabase.rpc("create_payment_notification", {
        p_name: account.name,
        p_title: title,
        p_body: body,
        p_dedupe_suffix: dedupeSuffix(bucket, item.date, todayISO),
        p_secret: secret,
      });

      if (error) {
        errors.push(`${account.name} / ${item.date} / ${bucket}: ${error.message}`);
      } else if (data === true) {
        inserted += 1;
      } else {
        skipped += 1; // no linked user, or already sent
      }
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    today: todayISO,
    accounts: accounts.length,
    attempted,
    inserted,
    skipped,
    errors,
    ...(dryRun ? { dryRun: true, preview } : {}),
  });
}
