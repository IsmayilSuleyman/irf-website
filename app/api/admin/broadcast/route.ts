import { NextResponse } from "next/server";
import { getAuthedContext, rpcErrorResponse } from "@/lib/api";
import { sendPush, type StoredSub } from "@/lib/push";

export const runtime = "nodejs";

type SubRow = StoredSub & { unread?: number };

// Owner custom notification. With { holderName } → one shareholder; without it
// → broadcast to every user. Both write to the bell + push-banner. Auth is
// enforced inside the is_fund_admin-gated RPCs.
export async function POST(req: Request) {
  const ctx = await getAuthedContext();
  if (ctx instanceof NextResponse) return ctx;

  const body = (await req.json().catch(() => null)) as
    | { holderName?: unknown; title?: unknown; body?: unknown }
    | null;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const message = typeof body?.body === "string" ? body.body.trim() : "";
  const holderName = typeof body?.holderName === "string" ? body.holderName.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "Mesaj tələb olunur." }, { status: 400 });
  }
  const finalTitle = title || "Elan";

  const pushAll = async (subs: SubRow[], tag: string) => {
    await Promise.all(
      subs.map((s) =>
        sendPush(s, {
          title: finalTitle,
          body: message,
          url: "/portal",
          unread: s.unread,
          tag,
        }).catch(() => undefined),
      ),
    );
  };

  // To one specific shareholder.
  if (holderName) {
    const { data, error } = await ctx.supabase.rpc("admin_send_user_notice", {
      p_holder_name: holderName,
      p_title: title,
      p_body: message,
    });
    if (error) return rpcErrorResponse(error);
    const res = (data ?? {}) as { sent?: boolean; unread?: number; subs?: SubRow[] };
    if (!res.sent) {
      return NextResponse.json(
        { error: "Bu şəxs üçün tətbiq hesabı tapılmadı." },
        { status: 404 },
      );
    }
    const subs = res.subs ?? [];
    await pushAll(subs, "irf-notice");
    return NextResponse.json({ sent: 1, pushed: subs.length });
  }

  // To everyone.
  const { data, error } = await ctx.supabase.rpc("admin_broadcast_notification", {
    p_title: title,
    p_body: message,
  });
  if (error) return rpcErrorResponse(error);
  const res = (data ?? {}) as { sent?: number; subs?: SubRow[] };
  const subs = res.subs ?? [];
  await pushAll(subs, "irf-announce");
  return NextResponse.json({ sent: res.sent ?? 0, pushed: subs.length });
}
