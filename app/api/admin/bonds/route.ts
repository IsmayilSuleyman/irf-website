import { NextResponse } from "next/server";
import { getAuthedContext, rpcErrorResponse } from "@/lib/api";
import { sendPush, type StoredSub } from "@/lib/push";

export const runtime = "nodejs";

type SubRow = StoredSub & { unread?: number };

type Recipient = {
  holder_name?: string;
  title?: string;
  body?: string;
  unread?: number;
  subs?: SubRow[];
};

// İsmayıl's bond administration: issue a series, confirm/reject pending
// trades, cancel an untraded series, record coupon/principal payments.
// Authorization is enforced inside the is_fund_admin-gated RPCs.
export async function POST(req: Request) {
  const ctx = await getAuthedContext();
  if (ctx instanceof NextResponse) return ctx;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.action !== "string") {
    return NextResponse.json({ error: "action is required" }, { status: 400 });
  }

  switch (body.action) {
    case "issue": {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const faceValue = Number(body.faceValue);
      const couponRatePct = Number(body.couponRatePct);
      const couponPeriodMonths = Number(body.couponPeriodMonths);
      const termMonths = Number(body.termMonths);
      const issuePrice = Number(body.issuePrice);
      const totalUnits = Number(body.totalUnits);
      if (!name) {
        return NextResponse.json({ error: "Seriya adı tələb olunur." }, { status: 400 });
      }
      for (const [label, v] of [
        ["faceValue", faceValue],
        ["couponRatePct", couponRatePct],
        ["issuePrice", issuePrice],
      ] as const) {
        if (!Number.isFinite(v)) {
          return NextResponse.json({ error: `${label} must be a number` }, { status: 400 });
        }
      }
      // These map to int RPC params — reject fractions before PostgREST rounds them.
      for (const [label, v] of [
        ["couponPeriodMonths", couponPeriodMonths],
        ["termMonths", termMonths],
        ["totalUnits", totalUnits],
      ] as const) {
        if (!Number.isInteger(v) || v <= 0) {
          return NextResponse.json(
            { error: `${label} must be a positive whole number` },
            { status: 400 },
          );
        }
      }

      const { data, error } = await ctx.supabase.rpc("admin_issue_bond_series", {
        p_name: name,
        p_face_value: faceValue,
        p_coupon_rate_pct: couponRatePct,
        p_coupon_period_months: couponPeriodMonths,
        p_term_months: termMonths,
        p_issue_price: issuePrice,
        p_total_units: totalUnits,
      });
      if (error) return rpcErrorResponse(error);

      // Optional announcement to every user (bell + push), reusing the
      // existing broadcast RPC so delivery matches other announcements.
      let announced = 0;
      if (body.announce === true) {
        const title = "Yeni istiqraz buraxılışı";
        const message =
          `${name}: nominal ${faceValue} ₼, kupon ${couponRatePct}% (hər ${couponPeriodMonths} ay), ` +
          `müddət ${termMonths} ay. Buraxılış qiyməti ${issuePrice} ₼, cəmi ${totalUnits} istiqraz.`;
        const { data: bData, error: bError } = await ctx.supabase.rpc(
          "admin_broadcast_notification",
          { p_title: title, p_body: message },
        );
        if (!bError) {
          const bRes = (bData ?? {}) as { sent?: number; subs?: SubRow[] };
          announced = bRes.sent ?? 0;
          await Promise.all(
            (bRes.subs ?? []).map((s) =>
              sendPush(s, {
                title,
                body: message,
                url: "/bonds",
                unread: s.unread,
                tag: "irf-bond",
              }).catch(() => undefined),
            ),
          );
        }
      }

      return NextResponse.json({ result: data, announced });
    }

    case "confirm":
    case "reject": {
      const tradeId = typeof body.tradeId === "string" ? body.tradeId : null;
      if (!tradeId) {
        return NextResponse.json({ error: "tradeId is required" }, { status: 400 });
      }
      const fn = body.action === "confirm" ? "confirm_bond_trade" : "reject_bond_trade";
      const { data, error } = await ctx.supabase.rpc(fn, { p_trade_id: tradeId });
      if (error) return rpcErrorResponse(error);
      return NextResponse.json({ result: data });
    }

    case "cancel_series": {
      const seriesId = typeof body.seriesId === "string" ? body.seriesId : null;
      if (!seriesId) {
        return NextResponse.json({ error: "seriesId is required" }, { status: 400 });
      }
      const { data, error } = await ctx.supabase.rpc("admin_cancel_bond_series", {
        p_series_id: seriesId,
      });
      if (error) return rpcErrorResponse(error);
      return NextResponse.json({ result: data });
    }

    case "record_payment": {
      const seriesId = typeof body.seriesId === "string" ? body.seriesId : null;
      const kind = body.kind === "principal" ? "principal" : body.kind === "coupon" ? "coupon" : null;
      const dueDate = typeof body.dueDate === "string" ? body.dueDate : null;
      if (!seriesId || !kind || !dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
        return NextResponse.json(
          { error: "seriesId, kind ('coupon'|'principal') and dueDate (YYYY-MM-DD) are required" },
          { status: 400 },
        );
      }
      const { data, error } = await ctx.supabase.rpc("record_bond_payment", {
        p_series_id: seriesId,
        p_kind: kind,
        p_due_date: dueDate,
      });
      if (error) return rpcErrorResponse(error);

      const res = (data ?? {}) as { count?: number; total_azn?: number; recipients?: Recipient[] };
      await Promise.all(
        (res.recipients ?? []).flatMap((r) =>
          (r.subs ?? []).map((s) =>
            sendPush(s, {
              title: r.title ?? "İstiqraz ödənişi",
              body: r.body ?? "",
              url: "/bonds",
              unread: r.unread,
              tag: "irf-bond-pay",
            }).catch(() => undefined),
          ),
        ),
      );

      return NextResponse.json({ result: data });
    }

    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
}
