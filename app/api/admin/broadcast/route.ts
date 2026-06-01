import { NextResponse } from "next/server";
import { getAuthedContext, rpcErrorResponse } from "@/lib/api";
import { sendPush, type StoredSub } from "@/lib/push";

export const runtime = "nodejs";

type BroadcastSub = StoredSub & { unread?: number };

// Owner-only: write a custom notification to every user + push-banner it.
// Authorization is enforced inside admin_broadcast_notification (is_fund_admin).
export async function POST(req: Request) {
  const ctx = await getAuthedContext();
  if (ctx instanceof NextResponse) return ctx;

  const body = (await req.json().catch(() => null)) as
    | { title?: unknown; body?: unknown }
    | null;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const message = typeof body?.body === "string" ? body.body.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "Mesaj tələb olunur." }, { status: 400 });
  }

  const { data, error } = await ctx.supabase.rpc("admin_broadcast_notification", {
    p_title: title,
    p_body: message,
  });
  if (error) return rpcErrorResponse(error);

  const res = (data ?? {}) as { sent?: number; subs?: BroadcastSub[] };
  const subs = res.subs ?? [];
  const finalTitle = title || "Elan";
  await Promise.all(
    subs.map((s) =>
      sendPush(s, {
        title: finalTitle,
        body: message,
        url: "/portal",
        unread: s.unread,
        tag: "irf-announce",
      }).catch(() => undefined),
    ),
  );

  return NextResponse.json({ sent: res.sent ?? 0, pushed: subs.length });
}
