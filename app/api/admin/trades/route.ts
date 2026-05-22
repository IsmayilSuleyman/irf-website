import { NextResponse } from "next/server";
import { getAuthedContext, rpcErrorResponse } from "@/lib/api";

export const runtime = "nodejs";

// Admin (İsmayıl) confirms settlement or rejects a pending matched trade.
// Authorization is enforced inside the confirm_trade / reject_trade RPCs.
export async function POST(req: Request) {
  const ctx = await getAuthedContext();
  if (ctx instanceof NextResponse) return ctx;

  let body: { action?: unknown; tradeId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const tradeId = typeof body.tradeId === "string" ? body.tradeId : null;
  if (!tradeId) {
    return NextResponse.json({ error: "tradeId is required" }, { status: 400 });
  }

  const fn =
    body.action === "confirm"
      ? "confirm_trade"
      : body.action === "reject"
        ? "reject_trade"
        : null;
  if (!fn) {
    return NextResponse.json({ error: "action must be 'confirm' or 'reject'" }, { status: 400 });
  }

  const { data, error } = await ctx.supabase.rpc(fn, { p_trade_id: tradeId });
  if (error) return rpcErrorResponse(error);
  return NextResponse.json({ result: data });
}
