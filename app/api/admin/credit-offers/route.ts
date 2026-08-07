import { NextResponse } from "next/server";
import { getAuthedContext, rpcErrorResponse } from "@/lib/api";

export const runtime = "nodejs";

// İsmayıl's cabinet: set or remove one account's credit offer. Authorization
// lives inside the RPCs (is_fund_admin) — the route only shapes the input.
export async function POST(req: Request) {
  const ctx = await getAuthedContext();
  if (ctx instanceof NextResponse) return ctx;

  const body = (await req.json().catch(() => null)) as
    | { holderName?: unknown; mode?: unknown; value?: unknown }
    | null;

  const holderName =
    typeof body?.holderName === "string" ? body.holderName.trim() : "";
  const mode = body?.mode === "azn" || body?.mode === "pct" ? body.mode : null;
  const value = Number(body?.value);

  if (!holderName) {
    return NextResponse.json({ error: "holderName tələb olunur." }, { status: 400 });
  }
  if (!mode) {
    return NextResponse.json({ error: "mode azn və ya pct olmalıdır." }, { status: 400 });
  }
  if (!Number.isFinite(value) || value <= 0) {
    return NextResponse.json({ error: "Düzgün məbləğ daxil edin." }, { status: 400 });
  }
  if (mode === "pct" && value > 100) {
    return NextResponse.json({ error: "Faiz 100-dən böyük ola bilməz." }, { status: 400 });
  }

  const { error } = await ctx.supabase.rpc("admin_set_credit_offer", {
    p_holder: holderName,
    p_mode: mode,
    p_value: value,
  });
  if (error) return rpcErrorResponse(error);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const ctx = await getAuthedContext();
  if (ctx instanceof NextResponse) return ctx;

  const body = (await req.json().catch(() => null)) as
    | { holderName?: unknown }
    | null;
  const holderName =
    typeof body?.holderName === "string" ? body.holderName.trim() : "";
  if (!holderName) {
    return NextResponse.json({ error: "holderName tələb olunur." }, { status: 400 });
  }

  const { error, data } = await ctx.supabase.rpc("admin_delete_credit_offer", {
    p_holder: holderName,
  });
  if (error) return rpcErrorResponse(error);
  return NextResponse.json(data ?? { ok: true });
}
