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

type Phase = "upcoming" | "tomorrow" | "today" | "overdue";
type ActiveItem = { k: string; title: string; body: string };

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

// A payment reminder is "active" (should be shown) from a week out onward until
// it's paid: each day in the final week, on the due date, and while overdue.
// More than a week away → not yet shown.
function phaseFor(days: number): Phase | null {
  if (days > 7) return null;
  if (days >= 2) return "upcoming";
  if (days === 1) return "tomorrow";
  if (days === 0) return "today";
  return "overdue";
}

// "2026-06-15" -> "15.06.2026" (Azerbaijani day-first display).
function humanDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

function composeMessage(
  phase: Phase,
  item: BankPaymentScheduleItem,
  days: number,
): { title: string; body: string } {
  const when = humanDate(item.date);
  const amount = item.amountAzn != null ? formatAzn(item.amountAzn) : null;
  const note = item.label ? ` ${item.label}.` : "";
  const sum = amount ? `${amount} ` : "";

  if (phase === "upcoming") {
    return {
      title: `Ödənişə ${days} gün qalıb`,
      body: `${when} tarixində ${sum}ödənişiniz var.${note}`,
    };
  }
  if (phase === "tomorrow") {
    return {
      title: "Ödənişə 1 gün qalıb",
      body: `Sabah (${when}) ${sum}ödənişiniz var.${note}`,
    };
  }
  if (phase === "today") {
    return {
      title: "Bu gün ödəniş günüdür",
      body: `Bu gün ${sum}ödənişiniz var.${note}`,
    };
  }
  return {
    title: "Ödəniş gecikib",
    body: `${when} tarixli ${sum}ödənişiniz hələ edilməyib.${note}`,
  };
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

  // ?dryRun=1 runs the full pipeline (live Sheet read + classification + message
  // composition) but performs no writes — previews what each account would show.
  // ?today=YYYY-MM-DD (dry-run only) simulates the run as if it were that date.
  const params = new URL(req.url).searchParams;
  const dryRun = params.get("dryRun") === "1";
  const overrideToday = dryRun ? params.get("today") : null;
  const todayISO =
    overrideToday && /^\d{4}-\d{2}-\d{2}$/.test(overrideToday)
      ? overrideToday
      : bakuTodayISO();
  const supabase = createClient(url, anon);

  const preview: Array<{ name: string; active: ActiveItem[] }> = [];
  let synced = 0; // accounts reconciled (linked to a user)
  let active = 0; // active reminders upserted across all accounts
  let deleted = 0; // stale (paid / out-of-window) reminders removed
  let skipped = 0; // accounts with a schedule but no linked user
  const errors: string[] = [];

  for (const account of accounts) {
    // Only loan holders carry a schedule; skip deposit-only / empty accounts.
    if (account.paymentSchedule.length === 0) continue;

    // The full set of reminders this account should currently show. One entry
    // per unpaid installment within the window; a stable key per due date so
    // the row updates in place day to day rather than piling up.
    const items: ActiveItem[] = [];
    for (const item of account.paymentSchedule) {
      if (isPaymentPaid(item.status)) continue;

      const days = daysUntil(item.date, todayISO);
      if (days == null) continue; // unparseable date — leave it alone

      const phase = phaseFor(days);
      if (!phase) continue;

      const { title, body } = composeMessage(phase, item, days);
      items.push({ k: `pay:${item.date}`, title, body });
    }

    if (dryRun) {
      if (items.length > 0) preview.push({ name: account.name, active: items });
      continue;
    }

    // Reconcile: upsert the active reminders and delete any now-paid ones.
    // Called even when items is empty, so a just-paid loan's reminders clear.
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
      skipped += 1; // no linked user to notify
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
