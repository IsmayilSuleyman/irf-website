import { NextResponse } from "next/server";
import { getAuthedContext, rpcErrorResponse } from "@/lib/api";
import { getBankAccounts, getBankAccountByName } from "@/lib/bank";
import { formatAzn } from "@/lib/portfolio";

export const runtime = "nodejs";

function debtMessage(amountAzn: number): { title: string; body: string } {
  return {
    title: "Borcunuzu ödəyin",
    body:
      amountAzn > 0
        ? `Qalıq borcunuz: ${formatAzn(amountAzn)}. Zəhmət olmasa ödənişi həyata keçirin.`
        : "Zəhmət olmasa borc ödənişinizi həyata keçirin.",
  };
}

// Admin-only: push a "pay your debt" notice to one borrower ({ holderName }) or
// to every borrower with outstanding debt ({ all: true }). Authorization is
// enforced inside admin_send_debt_notice (is_fund_admin); the amount is read
// from the Sheet server-side, never trusted from the client.
export async function POST(req: Request) {
  const ctx = await getAuthedContext();
  if (ctx instanceof NextResponse) return ctx;

  let body: { holderName?: unknown; all?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let targets: { name: string; amount: number }[] = [];
  if (body.all === true) {
    const accounts = await getBankAccounts();
    targets = accounts
      .filter((a) => a.outstandingLoanAzn > 0)
      .map((a) => ({ name: a.name, amount: a.outstandingLoanAzn }));
  } else if (typeof body.holderName === "string" && body.holderName.trim()) {
    const acc = await getBankAccountByName(body.holderName);
    if (!acc) {
      return NextResponse.json({ error: "Borclu tapılmadı." }, { status: 404 });
    }
    targets = [{ name: acc.name, amount: acc.outstandingLoanAzn }];
  } else {
    return NextResponse.json({ error: "holderName və ya all tələb olunur." }, { status: 400 });
  }

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];
  for (const t of targets) {
    const { title, body: text } = debtMessage(t.amount);
    const { data, error } = await ctx.supabase.rpc("admin_send_debt_notice", {
      p_holder_name: t.name,
      p_title: title,
      p_body: text,
    });
    if (error) {
      // Not admin → stop immediately (403); the first call settles authorization.
      if (error.code === "42501") return rpcErrorResponse(error);
      errors.push(`${t.name}: ${error.message}`);
    } else if (data === true) {
      sent += 1;
    } else {
      skipped += 1; // borrower has no linked app user
    }
  }

  return NextResponse.json({ sent, skipped, total: targets.length, errors });
}
