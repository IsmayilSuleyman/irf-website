import { NextResponse } from "next/server";
import { getAuthedContext, rpcErrorResponse } from "@/lib/api";
import { getBankAccountByName, getBankAccounts } from "@/lib/bank";
import { getBondFundingAzn } from "@/lib/bonds";
import { getMyCreditOffer, offerAmountAzn } from "@/lib/creditOffers";
import { displayNameOf } from "@/lib/user";
import { sendPushAll, type StoredSub } from "@/lib/push";

export const runtime = "nodejs";

// "Mənə maraqlıdır" on the credit-offer banner. The offered amount is
// recomputed HERE, server-side, from the caller's stored offer rule and the
// live liquidity — nothing about the figure comes from the client, so the
// ping İsmayıl receives cannot be inflated. The RPC dedupes to one
// notification per holder per Baku day.
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

  // Mirror the banner's eligibility: an active borrower shouldn't reach this
  // route at all, but the button is client-side — re-check.
  const account = await getBankAccountByName(name);
  if (account != null && account.outstandingLoanAzn > 0) {
    return NextResponse.json(
      { error: "Aktiv krediti olan hesab üçün təklif göstərilmir." },
      { status: 409 },
    );
  }

  let amountAzn: number;
  if (offer.mode === "azn") {
    amountAzn = offerAmountAzn(offer, 0);
  } else {
    const [accounts, bondFunding] = await Promise.all([
      getBankAccounts(),
      getBondFundingAzn(),
    ]);
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

  const res = (data ?? {}) as {
    sent?: boolean;
    already?: boolean;
    unread?: number;
    subs?: StoredSub[];
  };
  if (res.sent && (res.subs ?? []).length > 0) {
    await sendPushAll(res.subs ?? [], {
      title: "Kredit təklifinə maraq",
      body: `${name} ${amountAzn} ₼ məbləğində kredit təklifi ilə maraqlanır.`,
      url: "/bank",
      unread: res.unread,
      tag: "irf-credit-offer",
    });
  }

  return NextResponse.json({ ok: true, already: res.already === true });
}
