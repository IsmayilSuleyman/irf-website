import { NextResponse } from "next/server";
import { getAuthedContext, rpcErrorResponse } from "@/lib/api";
import {
  getBankAccounts,
  getBankAccountByName,
  isPaymentPaid,
  composeDebtReminderMessage,
  type BankAccount,
  type BankPaymentScheduleItem,
} from "@/lib/bank";

export const runtime = "nodejs";

// The borrower's earliest still-unpaid installment (oldest first) — the most
// pressing one to nudge about.
function earliestUnpaid(
  schedule: BankPaymentScheduleItem[],
): BankPaymentScheduleItem | null {
  const unpaid = schedule
    .filter((i) => !isPaymentPaid(i.status) && /^\d{4}-\d{2}-\d{2}$/.test(i.date.trim()))
    .sort((a, b) => a.date.localeCompare(b.date));
  return unpaid[0] ?? null;
}

// Admin-only: push the standard "pay your debt" notice (same wording as the
// daily reminder) to one borrower ({ holderName }) or every borrower with
// outstanding debt ({ all: true }). Authorization is enforced inside
// admin_send_debt_notice (is_fund_admin).
export async function POST(req: Request) {
  const ctx = await getAuthedContext();
  if (ctx instanceof NextResponse) return ctx;

  let body: { holderName?: unknown; all?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let targets: BankAccount[] = [];
  if (body.all === true) {
    const accounts = await getBankAccounts();
    targets = accounts.filter((a) => a.outstandingLoanAzn > 0);
  } else if (typeof body.holderName === "string" && body.holderName.trim()) {
    const acc = await getBankAccountByName(body.holderName);
    if (!acc) {
      return NextResponse.json({ error: "Borclu tapılmadı." }, { status: 404 });
    }
    targets = [acc];
  } else {
    return NextResponse.json({ error: "holderName və ya all tələb olunur." }, { status: 400 });
  }

  // A single explicit borrower with nothing unpaid → tell the admin clearly.
  if (
    body.all !== true &&
    targets.length === 1 &&
    !earliestUnpaid(targets[0].paymentSchedule)
  ) {
    return NextResponse.json(
      { error: "Bu borclu üçün ödənilməmiş ödəniş tapılmadı." },
      { status: 404 },
    );
  }

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];
  for (const acc of targets) {
    const item = earliestUnpaid(acc.paymentSchedule);
    const msg = item ? composeDebtReminderMessage(acc.name, item) : null;
    if (!msg) {
      skipped += 1; // no parseable unpaid installment to reference
      continue;
    }
    const { data, error } = await ctx.supabase.rpc("admin_send_debt_notice", {
      p_holder_name: acc.name,
      p_title: msg.title,
      p_body: msg.body,
    });
    if (error) {
      // Not admin → stop immediately (403).
      if (error.code === "42501") return rpcErrorResponse(error);
      errors.push(`${acc.name}: ${error.message}`);
    } else if (data === true) {
      sent += 1;
    } else {
      skipped += 1; // borrower has no linked app user
    }
  }

  return NextResponse.json({ sent, skipped, total: targets.length, errors });
}
