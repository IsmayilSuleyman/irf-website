import { NextResponse } from "next/server";
import { getAuthedContext, rpcErrorResponse } from "@/lib/api";

export const runtime = "nodejs";

// List the caller's recent notifications + their unread count.
export async function GET() {
  const ctx = await getAuthedContext();
  if (ctx instanceof NextResponse) return ctx;

  const [listRes, countRes] = await Promise.all([
    ctx.supabase
      .from("notifications")
      .select("id, kind, trade_id, title, body, read, created_at")
      .order("created_at", { ascending: false })
      .limit(30),
    ctx.supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("read", false),
  ]);

  if (listRes.error) {
    return NextResponse.json({ error: listRes.error.message }, { status: 400 });
  }
  return NextResponse.json({ items: listRes.data ?? [], unread: countRes.count ?? 0 });
}

// Mark notifications read (all unread, or a specific set of ids).
export async function POST(req: Request) {
  const ctx = await getAuthedContext();
  if (ctx instanceof NextResponse) return ctx;

  let ids: string[] | null = null;
  try {
    const body = await req.json();
    if (Array.isArray(body?.ids)) ids = body.ids;
  } catch {
    ids = null;
  }

  const { data, error } = await ctx.supabase.rpc("mark_notifications_read", { p_ids: ids });
  if (error) return rpcErrorResponse(error);
  return NextResponse.json({ result: data });
}
