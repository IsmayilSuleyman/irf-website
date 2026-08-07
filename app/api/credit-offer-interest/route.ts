import { NextResponse } from "next/server";
import { getAuthedContext, rpcErrorResponse } from "@/lib/api";
import { getBankAccounts } from "@/lib/bank";
import { getBondFundingAzn } from "@/lib/bonds";
import { getMyCreditOffer, offerAmountAzn } from "@/lib/creditOffers";
import { displayNameOf } from "@/lib/user";
import { formatGrouped } from "@/lib/portfolio";
import { sendPushAll, type StoredSub } from "@/lib/push";

export const runtime = "nodejs";

const norm = (s: string) =>
  s.trim().replace(/[İIı]/g, "i").replace(/\s+/g, " ").toLowerCase();

// "Mənə maraqlıdır" on the credit-offer banner. The offered amount is
// recomputed HERE, server-side, from the caller's stored offer rule and the
// live liquidity — nothing numeric comes from the client (and for fixed
// offers the RPC re-verifies the figure against the stored rule). The RPC
// dedupes to one notification per holder per Baku day; the push data comes
// from the cron-secret-gated admin_push_context, never from a user-callable
// surface.
export async function POST() {
  const ctx = await getAuthedContext();
  if (ctx instanceof NextResponse) return ctx;

  const name = displayNameOf(ctx.user.user_metadata);
  const offer = await getMyCreditOffer(name);
  if (!offer) {
    return NextResponse.json(
      { error: "Sizin üçün aktiv kredit təklifi yoxdur." },
      { status: 404 },
    );
  }

  // Eligibility re-check, FAIL CLOSED: getBankAccounts() returns [] when the
  // Sheets read fails, and an empty bank would otherwise make every borrower
  // look loan-free. No accounts → no ping.
  const accounts = await getBankAccounts();
  if (accounts.length === 0) {
    return NextResponse.json(
      { error: "Bank məlumatı müvəqqəti əlçatan deyil — bir azdan yenidən cəhd edin." },
      { status: 503 },
    );
  }
  const row = name
    ? accounts.find((a) => norm(a.name) === norm(name))
    : undefined;
  if (row != null && row.outstandingLoanAzn > 0) {
    return NextResponse.json(
      { error: "Aktiv krediti olan hesab üçün təklif göstərilmir." },
      { status: 409 },
    );
  }

  let amountAzn: number;
  if (offer.mode === "azn") {
    amountAzn = offerAmountAzn(offer, 0);
  } else {
    const bondFunding = await getBondFundingAzn();
    const deposits = accounts.reduce((s, a) => s + a.depositedAzn, 0);
    const loans = accounts.reduce((s, a) => s + a.outstandingLoanAzn, 0);
    amountAzn = offerAmountAzn(offer, deposits + bondFunding - loans);
  }
  if (amountAzn <= 0) {
    return NextResponse.json(
      { error: "Təklif məbləği hazırda hesablana bilmir." },
      { status: 409 },
    );
  }

  const { data, error } = await ctx.supabase.rpc("credit_offer_interest", {
    p_amount_azn: amountAzn,
  });
  if (error) return rpcErrorResponse(error);

  const res = (data ?? {}) as { sent?: boolean; already?: boolean };
  if (res.sent) {
    // Push context is cron-secret gated — the user-callable RPC no longer
    // carries the admin's subscription secrets.
    const secret = process.env.PAYMENT_REMINDER_SECRET;
    if (secret) {
      const pushRes = await ctx.supabase.rpc("admin_push_context", {
        p_secret: secret,
      });
      const pushCtx = (pushRes.data ?? {}) as {
        unread?: number;
        subs?: StoredSub[];
      };
      if (!pushRes.error && (pushCtx.subs ?? []).length > 0) {
        await sendPushAll(pushCtx.subs ?? [], {
          title: "Kredit təklifinə maraq",
          body: `${name} ${formatGrouped(amountAzn, 0)} ₼ məbləğində kredit təklifi ilə maraqlanır.`,
          url: "/bank",
          unread: pushCtx.unread,
          tag: "irf-credit-offer",
        });
      }
    }
  }

  return NextResponse.json({ ok: true, already: res.already === true });
}
