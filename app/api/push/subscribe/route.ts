import { NextResponse } from "next/server";
import { getAuthedContext } from "@/lib/api";

export const runtime = "nodejs";

type PushSub = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

// Store / remove the caller's Web Push subscription (RLS pins it to their user).
export async function POST(req: Request) {
  const ctx = await getAuthedContext();
  if (ctx instanceof NextResponse) return ctx;

  const body = (await req.json().catch(() => null)) as { subscription?: PushSub } | null;
  const sub = body?.subscription;
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const { error } = await ctx.supabase
    .from("push_subscriptions")
    .upsert(
      { endpoint, user_id: ctx.user.id, p256dh, auth },
      { onConflict: "endpoint" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const ctx = await getAuthedContext();
  if (ctx instanceof NextResponse) return ctx;

  const body = (await req.json().catch(() => null)) as { endpoint?: string } | null;
  const endpoint = body?.endpoint;
  if (!endpoint) {
    return NextResponse.json({ error: "endpoint required" }, { status: 400 });
  }
  await ctx.supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return NextResponse.json({ ok: true });
}
