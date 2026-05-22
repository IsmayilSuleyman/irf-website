import { NextResponse } from "next/server";
import { getAuthedContext, rpcErrorResponse } from "@/lib/api";

export const runtime = "nodejs";

// A party (buyer or seller) rejects a pending matched trade.
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
  if (body.action !== "reject") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }
  if (!tradeId) {
    return NextResponse.json({ error: "tradeId is required" }, { status: 400 });
  }

  const { data, error } = await ctx.supabase.rpc("reject_trade", { p_trade_id: tradeId });
  if (error) return rpcErrorResponse(error);
  return NextResponse.json({ result: data });
}
