import { NextResponse } from "next/server";
import { getAuthedContext, rpcErrorResponse } from "@/lib/api";

export const runtime = "nodejs";

// A trade party rejects a pending bond match (returns units to the orders).
// Authorization (party-or-admin) is enforced inside reject_bond_trade.
export async function POST(req: Request) {
  const ctx = await getAuthedContext();
  if (ctx instanceof NextResponse) return ctx;

  let body: { action?: unknown; tradeId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.action !== "reject") {
    return NextResponse.json({ error: "action must be 'reject'" }, { status: 400 });
  }
  const tradeId = typeof body.tradeId === "string" ? body.tradeId : null;
  if (!tradeId) {
    return NextResponse.json({ error: "tradeId is required" }, { status: 400 });
  }

  const { data, error } = await ctx.supabase.rpc("reject_bond_trade", {
    p_trade_id: tradeId,
  });
  if (error) return rpcErrorResponse(error);
  return NextResponse.json({ result: data });
}
