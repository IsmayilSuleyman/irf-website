import { NextResponse } from "next/server";
import { getAuthedContext, rpcErrorResponse } from "@/lib/api";

export const runtime = "nodejs";

// Place a buy/sell order (auto-matches inside the DB).
export async function POST(req: Request) {
  const ctx = await getAuthedContext();
  if (ctx instanceof NextResponse) return ctx;

  let body: { side?: unknown; units?: unknown; price?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const side = body.side;
  const units = Number(body.units);
  const price = Number(body.price);

  if (side !== "buy" && side !== "sell") {
    return NextResponse.json({ error: "side must be 'buy' or 'sell'" }, { status: 400 });
  }
  if (!Number.isFinite(units) || units <= 0) {
    return NextResponse.json({ error: "units must be a positive number" }, { status: 400 });
  }
  if (!Number.isFinite(price) || price <= 0) {
    return NextResponse.json({ error: "price must be a positive number" }, { status: 400 });
  }

  const { data, error } = await ctx.supabase.rpc("place_order", {
    p_side: side,
    p_units: units,
    p_price: price,
  });
  if (error) return rpcErrorResponse(error);
  return NextResponse.json({ result: data });
}

// Cancel an open/partial order (mode "cancel", default) or remove a finished
// order from the user's list (mode "delete" -> soft hide).
export async function DELETE(req: Request) {
  const ctx = await getAuthedContext();
  if (ctx instanceof NextResponse) return ctx;

  let orderId: string | null = null;
  let mode = "cancel";
  try {
    const body = await req.json();
    orderId = body?.orderId ?? null;
    if (body?.mode === "delete") mode = "delete";
  } catch {
    const url = new URL(req.url);
    orderId = url.searchParams.get("orderId");
    if (url.searchParams.get("mode") === "delete") mode = "delete";
  }
  if (!orderId) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 });
  }

  const fn = mode === "delete" ? "delete_order" : "cancel_order";
  const { data, error } = await ctx.supabase.rpc(fn, { p_order_id: orderId });
  if (error) return rpcErrorResponse(error);
  return NextResponse.json({ result: data });
}
