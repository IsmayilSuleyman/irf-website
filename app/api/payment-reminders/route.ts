import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getBankAccounts,
  isPaymentPaid,
  composeDebtReminderMessage,
} from "@/lib/bank";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ActiveItem = { k: string; title: string; body: string };

// Today's calendar date in Asia/Baku as "YYYY-MM-DD" (en-CA yields ISO order).
function bakuTodayISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Baku" });
}

// Parse a "YYYY-MM-DD" date to UTC-midnight ms. Both due dates and "today" are
// pinned to UTC midnight so the day difference is a clean calendar-day count.
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

type SyncResult = { linked?: boolean; active?: number; deleted?: number };

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

  // ?dryRun=1 runs the full pipeline (live Sheet read + message composition) but
  // performs no writes. ?today=YYYY-MM-DD (dry-run only) simulates a run date.
  const params = new URL(req.url).searchParams;
  const dryRun = params.get("dryRun") === "1";
  const overrideToday = dryRun ? params.get("today") : null;
  const todayISO =
    overrideToday && /^\d{4}-\d{2}-\d{2}$/.test(overrideToday)
      ? overrideToday
      : bakuTodayISO();
  const supabase = createClient(url, anon);

  const preview: Array<{ name: string; active: ActiveItem[] }> = [];
  let synced = 0;
  let active = 0;
  let deleted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const account of accounts) {
    if (account.paymentSchedule.length === 0) continue;

    // Reminders run daily for every unpaid installment from a week out until it
    // is paid (incl. the due date and while overdue). > 7 days away → not yet.
    const items: ActiveItem[] = [];
    for (const item of account.paymentSchedule) {
      if (isPaymentPaid(item.status)) continue;

      const days = daysUntil(item.date, todayISO);
      if (days == null || days > 7) continue;

      const msg = composeDebtReminderMessage(account.name, item);
      if (!msg) continue;

      items.push({ k: `pay:${item.date}`, title: msg.title, body: msg.body });
    }

    if (dryRun) {
      if (items.length > 0) preview.push({ name: account.name, active: items });
      continue;
    }

    // Reconcile: upsert the active reminders and delete any now-paid ones.
    const { data, error } = await supabase.rpc("sync_payment_notifications", {
      p_name: account.name,
      p_items: items,
      p_secret: secret,
    });

    if (error) {
      errors.push(`${account.name}: ${error.message}`);
      continue;
    }

    const res = (data ?? {}) as SyncResult;
    if (res.linked) {
      synced += 1;
      active += res.active ?? 0;
      deleted += res.deleted ?? 0;
    } else {
      skipped += 1;
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    today: todayISO,
    accounts: accounts.length,
    synced,
    active,
    deleted,
    skipped,
    errors,
    ...(dryRun ? { dryRun: true, preview } : {}),
  });
}
